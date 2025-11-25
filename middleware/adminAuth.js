const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function adminAuthMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the firm to check admin status
    const firm = await prisma.firm.findUnique({
      where: { id: decoded.firmId },
      select: {
        id: true,
        email: true,
        firmName: true,
        isAdmin: true,
        role: true,
        status: true
      }
    });

    if (!firm) {
      return res.status(401).json({ message: 'Firm not found' });
    }

    // Check if account is active
    if (firm.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Check if user has admin privileges
    if (!firm.isAdmin && firm.role !== 'admin' && firm.role !== 'superadmin') {
      return res.status(403).json({
        message: 'Admin access required',
        requiredRole: 'admin'
      });
    }

    // Attach firm info to request
    req.user = decoded;
    req.admin = firm;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('Admin auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

// Optional: Middleware for superadmin-only routes
async function superadminAuthMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const firm = await prisma.firm.findUnique({
      where: { id: decoded.firmId },
      select: {
        id: true,
        email: true,
        firmName: true,
        role: true,
        status: true
      }
    });

    if (!firm) {
      return res.status(401).json({ message: 'Firm not found' });
    }

    if (firm.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    if (firm.role !== 'superadmin') {
      return res.status(403).json({
        message: 'Superadmin access required',
        requiredRole: 'superadmin'
      });
    }

    req.user = decoded;
    req.admin = firm;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    console.error('Superadmin auth error:', error);
    return res.status(500).json({ message: 'Authentication error' });
  }
}

module.exports = {
  adminAuthMiddleware,
  superadminAuthMiddleware
};
