const { PrismaClient } = require('@prisma/client');

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// This is especially important for serverless environments
const globalForPrisma = global;

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

const prisma = globalForPrisma.prisma;

// Ensure the client disconnects properly in serverless environments
if (process.env.VERCEL) {
  // Don't disconnect on Vercel - let it reuse connections
  process.on('beforeExit', () => {
    // Cleanup if needed
  });
}

module.exports = prisma;
