require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');

if (!process.env.JWT_SECRET) {
  console.error(
    'FATAL: JWT_SECRET is not set. Add it as an environment variable (see .env.example).'
  );
  process.exit(1);
}

const app = express();

// Render terminates TLS at its proxy; trust the first hop so req.ip and
// rate limiting see the real client IP.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      // Redundant behind Render's HTTPS and breaks plain-HTTP localhost dev.
      directives: { 'upgrade-insecure-requests': null },
    },
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Every API route needs the database; answer clearly instead of hanging
// on buffered queries when it is down.
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(503)
      .json({ error: 'Database not connected. Please try again shortly.' });
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', require('./routes/employees'));

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Single-page frontend: send index.html for any other GET.
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;

async function connectDB() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      'DATABASE_URL is not set — API requests will return 503 until it is configured.'
    );
    return;
  }
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('MongoDB connected');
      return;
    } catch (err) {
      console.error(
        `MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`
      );
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }
  console.error(
    'Could not connect to MongoDB. Check DATABASE_URL and Atlas network access (0.0.0.0/0).'
  );
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bonus Calculator listening on port ${PORT}`);
});

connectDB();
