const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL = '7d';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in a few minutes.' },
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });
    }
    if (password.length > 72) {
      return res.status(400).json({ error: 'Password is too long (max 72)' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.email !== normalizedEmail) {
        // A lookup for one email must never return another; fail loudly.
        console.error(
          `register: findOne(${normalizedEmail}) returned a different doc (${existing.email})`
        );
        return res
          .status(500)
          .json({ error: 'Registration lookup failed [diag: lookup-mismatch]' });
      }
      return res
        .status(409)
        .json({ error: 'An account with that email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: bcrypt.hashSync(password, 10),
    });

    res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    if (err.code === 11000) {
      // Only report an email conflict when the email index is what collided;
      // a duplicate on any other (stray) index is a server problem, not the user's.
      const dupFields = Object.keys(err.keyPattern || {});
      if (dupFields.length === 0 || dupFields.includes('email')) {
        return res
          .status(409)
          .json({ error: 'An account with that email already exists' });
      }
      console.error(
        `register: duplicate-key error on non-email index; keyPattern=${JSON.stringify(err.keyPattern)} keyValue=${JSON.stringify(err.keyValue)}`
      );
      return res.status(500).json({
        error: `Registration failed [diag: stray unique index on "${dupFields.join(',')}"]`,
      });
    }
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user || !bcrypt.compareSync(String(password), user.passwordHash)) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    res.json({ token: signToken(user), user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

// Change password for the signed-in user (requires the current password).
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current and new password are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 8 characters' });
    }
    if (newPassword.length > 72) {
      return res.status(400).json({ error: 'New password is too long (max 72)' });
    }

    // requireAuth strips the hash; reload it for comparison.
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    // 400 (not 401) so the client doesn't treat this as an expired session.
    if (!bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
