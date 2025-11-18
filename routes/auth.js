const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Register new firm
router.post('/register', async (req, res) => {
  try {
    const { firmName, email, password, contactPerson } = req.body;
    const db = req.app.locals.db;

    // Check if firm already exists
    const existingFirm = db.firms.find(f => f.email === email);
    if (existingFirm) {
      return res.status(400).json({ message: 'Firm already registered with this email' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new firm
    const newFirm = {
      id: uuidv4(),
      firmName,
      email,
      password: hashedPassword,
      contactPerson,
      profile: {
        jurisdictions: [],
        typicalDealSize: { min: 0, max: 0 },
        sectorFocus: [],
        recentTransactions: []
      },
      createdAt: new Date().toISOString()
    };

    db.firms.push(newFirm);

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
        email: newFirm.email
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
    const db = req.app.locals.db;

    // Find firm
    const firm = db.firms.find(f => f.email === email);
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
        email: firm.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
