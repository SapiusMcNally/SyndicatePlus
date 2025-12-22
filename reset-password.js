require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function resetPassword() {
  try {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
      console.log('Usage: node reset-password.js <email> <new-password>');
      console.log('Example: node reset-password.js andrew.mcnally@sapius.co.uk Password123!');
      process.exit(1);
    }

    // Find the user
    const firm = await prisma.firm.findUnique({
      where: { email }
    });

    if (!firm) {
      console.log(`❌ No account found with email: ${email}`);
      process.exit(1);
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await prisma.firm.update({
      where: { email },
      data: { password: hashedPassword }
    });

    console.log('✅ Password reset successfully!\n');
    console.log('Login Details:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${newPassword}`);
    console.log(`  Firm: ${firm.firmName}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    process.exit(1);
  }
}

resetPassword();
