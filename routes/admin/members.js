const express = require('express');
const router = express.Router();
const prisma = require('../../lib/prisma');
const bcrypt = require('bcryptjs');
const { adminAuthMiddleware, superadminAuthMiddleware } = require('../../middleware/adminAuth');

// Get all firms with pagination and filtering
router.get('/firms', adminAuthMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      role = 'all'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {
      ...(search && {
        OR: [
          { firmName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status !== 'all' && { status }),
      ...(role !== 'all' && { role })
    };

    // Get firms with counts
    const [firms, total] = await Promise.all([
      prisma.firm.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          firmName: true,
          isAdmin: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              deals: true,
              sentInvitations: true,
              receivedInvitations: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.firm.count({ where })
    ]);

    res.json({
      firms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching firms:', error);
    res.status(500).json({ error: 'Failed to fetch firms' });
  }
});

// Get single firm details
router.get('/firms/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const firm = await prisma.firm.findUnique({
      where: { id },
      include: {
        deals: {
          select: {
            id: true,
            dealName: true,
            targetAmount: true,
            sector: true,
            status: true,
            createdAt: true
          }
        },
        enrichment: true,
        _count: {
          select: {
            deals: true,
            sentInvitations: true,
            receivedInvitations: true,
            ndas: true
          }
        }
      }
    });

    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }

    // Don't send password to frontend
    const { password, ...firmWithoutPassword } = firm;

    res.json(firmWithoutPassword);
  } catch (error) {
    console.error('Error fetching firm:', error);
    res.status(500).json({ error: 'Failed to fetch firm details' });
  }
});

// Update firm status (activate/suspend)
router.patch('/firms/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Prevent admins from suspending themselves
    if (id === req.admin.id && status !== 'active') {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    const updatedFirm = await prisma.firm.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        firmName: true,
        email: true,
        status: true,
        updatedAt: true
      }
    });

    res.json({
      message: `Firm status updated to ${status}`,
      firm: updatedFirm
    });
  } catch (error) {
    console.error('Error updating firm status:', error);
    res.status(500).json({ error: 'Failed to update firm status' });
  }
});

// Update firm role (superadmin only)
router.patch('/firms/:id/role', superadminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Prevent changing own role
    if (id === req.admin.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const isAdmin = role === 'admin' || role === 'superadmin';

    const updatedFirm = await prisma.firm.update({
      where: { id },
      data: {
        role,
        isAdmin
      },
      select: {
        id: true,
        firmName: true,
        email: true,
        role: true,
        isAdmin: true,
        updatedAt: true
      }
    });

    res.json({
      message: `Firm role updated to ${role}`,
      firm: updatedFirm
    });
  } catch (error) {
    console.error('Error updating firm role:', error);
    res.status(500).json({ error: 'Failed to update firm role' });
  }
});

// Delete firm (superadmin only)
router.delete('/firms/:id', superadminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.admin.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if firm exists
    const firm = await prisma.firm.findUnique({
      where: { id },
      select: { firmName: true }
    });

    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }

    // Delete firm (cascade will handle related records)
    await prisma.firm.delete({
      where: { id }
    });

    res.json({
      message: `Firm "${firm.firmName}" has been deleted`,
      deletedFirmId: id
    });
  } catch (error) {
    console.error('Error deleting firm:', error);
    res.status(500).json({ error: 'Failed to delete firm' });
  }
});

// Get platform statistics
router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const [
      totalFirms,
      activeFirms,
      suspendedFirms,
      totalDeals,
      activeDeals,
      totalInvitations,
      acceptedInvitations,
      totalNDAs
    ] = await Promise.all([
      prisma.firm.count(),
      prisma.firm.count({ where: { status: 'active' } }),
      prisma.firm.count({ where: { status: 'suspended' } }),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: { not: 'draft' } } }),
      prisma.invitation.count(),
      prisma.invitation.count({ where: { status: 'accepted' } }),
      prisma.nDA.count()
    ]);

    const stats = {
      firms: {
        total: totalFirms,
        active: activeFirms,
        suspended: suspendedFirms,
        inactive: totalFirms - activeFirms - suspendedFirms
      },
      deals: {
        total: totalDeals,
        active: activeDeals,
        draft: totalDeals - activeDeals
      },
      invitations: {
        total: totalInvitations,
        accepted: acceptedInvitations,
        pending: totalInvitations - acceptedInvitations,
        acceptanceRate: totalInvitations > 0
          ? ((acceptedInvitations / totalInvitations) * 100).toFixed(2)
          : 0
      },
      ndas: {
        total: totalNDAs
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Create admin account (superadmin only)
router.post('/create-admin', superadminAuthMiddleware, async (req, res) => {
  try {
    const { email, password, firmName, role = 'admin' } = req.body;

    if (!email || !password || !firmName) {
      return res.status(400).json({ error: 'Email, password, and firm name are required' });
    }

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid admin role' });
    }

    // Check if email already exists
    const existingFirm = await prisma.firm.findUnique({
      where: { email }
    });

    if (existingFirm) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin account
    const admin = await prisma.firm.create({
      data: {
        email,
        password: hashedPassword,
        firmName,
        isAdmin: true,
        role,
        status: 'active',
        profile: {
          type: 'admin',
          createdBy: req.admin.email
        }
      },
      select: {
        id: true,
        email: true,
        firmName: true,
        role: true,
        isAdmin: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      admin
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

module.exports = router;
