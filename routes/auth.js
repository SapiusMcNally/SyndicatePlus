const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { sendPasswordResetEmail } = require('../lib/email');

// Register new firm
router.post('/register', async (req, res) => {
  try {
    const { firmName, email, password, contactPerson } = req.body;

    // Check if firm already exists
    const existingFirm = await prisma.firm.findUnique({
      where: { email }
    });

    if (existingFirm) {
      return res.status(400).json({ message: 'Firm already registered with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new firm
    const newFirm = await prisma.firm.create({
      data: {
        firmName,
        email,
        password: hashedPassword,
        profile: {
          contactPerson,
          jurisdictions: [],
          typicalDealSize: { min: 0, max: 0 },
          sectorFocus: [],
          recentTransactions: []
        }
      }
    });

    // Create JWT token
    const token = jwt.sign(
      { firmId: newFirm.id, email: newFirm.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Firm registered successfully',
      token,
      firm: {
        id: newFirm.id,
        firmName: newFirm.firmName,
        email: newFirm.email,
        isAdmin: newFirm.isAdmin,
        role: newFirm.role,
        status: newFirm.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find firm
    const firm = await prisma.firm.findUnique({
      where: { email }
    });

    if (!firm) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, firm.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { firmId: firm.id, email: firm.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      firm: {
        id: firm.id,
        firmName: firm.firmName,
        email: firm.email,
        isAdmin: firm.isAdmin,
        role: firm.role,
        status: firm.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find firm by email
    const firm = await prisma.firm.findUnique({
      where: { email }
    });

    // Always return success to prevent email enumeration
    if (!firm) {
      return res.json({
        message: 'If an account exists with this email, you will receive a password reset link shortly.'
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Delete any existing unused tokens for this firm
    await prisma.passwordResetToken.deleteMany({
      where: {
        firmId: firm.id,
        used: false
      }
    });

    // Create new password reset token (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        firmId: firm.id,
        expiresAt,
      }
    });

    // Build reset URL
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail(firm.email, resetUrl, firm.firmName);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.json({
      message: 'If an account exists with this email, you will receive a password reset link shortly.'
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log('Reset password request received');

    if (!token || !newPassword) {
      console.log('Missing token or password');
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      console.log('Password too short');
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash the token to compare with database
    console.log('Hashing token...');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    console.log('Looking up reset token in database...');
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        used: false,
        expiresAt: {
          gt: new Date() // Token must not be expired
        }
      },
      include: {
        firm: true
      }
    });

    if (!resetToken) {
      console.log('Invalid or expired token');
      return res.status(400).json({
        message: 'Invalid or expired password reset token'
      });
    }

    console.log('Token valid, hashing new password...');
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    console.log('Updating database...');
    // Update password and mark token as used
    await prisma.$transaction([
      prisma.firm.update({
        where: { id: resetToken.firmId },
        data: { password: hashedPassword }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true }
      })
    ]);

    console.log('Password reset successful');
    res.json({
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Error in reset-password:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
