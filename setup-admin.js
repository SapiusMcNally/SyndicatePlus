require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function createSuperAdmin() {
  try {
    console.log('Creating superadmin account...\n');

    // Get admin details from command line or use defaults
    const email = process.argv[2] || 'admin@syndicateplus.com';
    const password = process.argv[3] || 'Admin123!';
    const firmName = process.argv[4] || 'Syndicate+ Administration';

    console.log(`Email: ${email}`);
    console.log(`Firm Name: ${firmName}`);
    console.log(`Password: ${password}\n`);

    // Check if admin already exists
    const existingAdmin = await prisma.firm.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('❌ Admin account already exists with this email!');
      console.log('Use a different email or delete the existing account first.\n');
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create superadmin account
    const admin = await prisma.firm.create({
      data: {
        email,
        password: hashedPassword,
        firmName,
        isAdmin: true,
        role: 'superadmin',
        status: 'active',
        profile: {
          type: 'admin',
          createdAt: new Date().toISOString()
        }
      }
    });

    console.log('✅ Superadmin account created successfully!\n');
    console.log('Login Details:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`\nYou can now login at:`);
    console.log(`  Local: http://localhost:3000/admin`);
    console.log(`  Production: https://syndicate-plus-hyck.vercel.app/admin\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
