const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Register interest
router.post('/register', async (req, res) => {
    try {
        const { name, email, company, message } = req.body;

        if (!name || !email || !company) {
            return res.status(400).json({ message: 'Name, email, and company are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        await prisma.interestRegistration.create({
            data: {
                name,
                email,
                company,
                message: message || null
            }
        });

        res.json({
            message: 'Thank you for your interest! We will be in touch soon.',
            success: true
        });
    } catch (error) {
        console.error('Error registering interest:', error);
        res.status(500).json({ message: 'Failed to register interest' });
    }
});

// Get all interest registrations (admin only - you can add auth middleware later)
router.get('/all', async (req, res) => {
    try {
        const results = await prisma.interestRegistration.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.json(results);
    } catch (error) {
        console.error('Error fetching interest registrations:', error);
        res.status(500).json({ message: 'Failed to fetch interest registrations' });
    }
});

module.exports = router;
