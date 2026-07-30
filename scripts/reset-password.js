// Admin utility: reset an account's password directly in the database.
// Usage: node scripts/reset-password.js <email> <new password (8+ chars)>
// Requires DATABASE_URL in the environment (create .env from .env.example).
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.error('Usage: node scripts/reset-password.js <email> <new password (8+ chars)>');
    process.exit(1);
  }

  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('DATABASE_URL is not set — create .env from .env.example first.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    console.error(`No account found for ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.passwordHash = bcrypt.hashSync(password, 10);
  await user.save();
  console.log(`Password updated for ${user.email}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
