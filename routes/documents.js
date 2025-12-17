const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put, del, list } = require('@vercel/blob');
const { authMiddleware } = require('../middleware/auth');
const prisma = require('../lib/prisma');

// Configure multer to use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Upload document to deal locker
router.post('/upload/:dealId', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { dealId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Verify deal exists and user has access
    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Check if user has access to this deal (owner or syndicate member)
    if (deal.firmId !== req.user.firmId && !deal.syndicateMembers.includes(req.user.firmId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Upload to Vercel Blob
    const filename = `${dealId}/${Date.now()}-${req.file.originalname}`;
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Save document metadata to database
    const document = await prisma.document.create({
      data: {
        dealId: dealId,
        fileName: req.file.originalname,
        fileUrl: blob.url,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        uploadedBy: req.user.firmId,
      },
    });

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: document,
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      message: 'Server error while uploading document',
      error: error.message,
    });
  }
});

// Get all documents for a deal
router.get('/deal/:dealId', authMiddleware, async (req, res) => {
  try {
    const { dealId } = req.params;

    // Verify deal exists and user has access
    const deal = await prisma.deal.findUnique({
      where: { id: dealId }
    });

    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Check if user has access to this deal
    if (deal.firmId !== req.user.firmId && !deal.syndicateMembers.includes(req.user.firmId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all documents for this deal
    const documents = await prisma.document.findMany({
      where: { dealId: dealId },
      include: {
        uploader: {
          select: {
            id: true,
            firmName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      message: 'Server error while fetching documents',
      error: error.message,
    });
  }
});

// Delete a document
router.delete('/:documentId', authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { deal: true },
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has permission to delete (must be uploader or deal owner)
    if (
      document.uploadedBy !== req.user.firmId &&
      document.deal.firmId !== req.user.firmId
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete from Vercel Blob
    try {
      await del(document.fileUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (blobError) {
      console.error('Error deleting from Blob storage:', blobError);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      message: 'Server error while deleting document',
      error: error.message,
    });
  }
});

module.exports = router;
