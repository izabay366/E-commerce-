/**
 * server.js
 * Entry point for the Muhanga Marketplace REST API.
 *
 * Configures:
 *  - Environment variables (dotenv)
 *  - Express middleware (helmet, cors, json parsing, rate limiting)
 *  - API routes
 *  - Health check endpoint
 *  - Server startup
 */

// Load environment variables FIRST, before any other imports
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

// Import database pool (establishes & tests connection on startup)
require('./config/database');

// Import route modules
const productRoutes  = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const offerRoutes    = require('./routes/offerRoutes');
const cartRoutes     = require('./routes/cartRoutes');
const authRoutes     = require('./routes/authRoutes');
const orderRoutes    = require('./routes/orderRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');
const userRoutes     = require('./routes/userRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const { serviceRouter, cleanerRouter, requestRouter } = require('./routes/cleaningRoutes');


// ─── App Setup ────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 5000;

// Trust Render's reverse proxy so express-rate-limit reads the real client IP
app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────

// Security headers — allow images served from our own /uploads endpoint
const frontendOrigin = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const apiOrigin      = `http://localhost:${process.env.PORT || 5000}`;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      // Allow images from the API server and configured frontend origin only
      'img-src': ["'self'", 'data:', apiOrigin, frontendOrigin],
    },
  },
}));

// Restrict CORS to the configured frontend origin only (not open to all origins)
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Parse incoming JSON bodies — 10kb limit prevents payload bloat attacks
app.use(express.json({ limit: '10kb' }));

// Global rate limiter — 100 requests per IP per 15 min across all /api routes.
// Reduced from 200: cuts bot/script abuse in half with no noticeable impact
// on legitimate users who typically make far fewer requests per session.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests. Please slow down and try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// Serve uploaded product images statically — with explicit CORS headers so
// the React dev server on :3000 can load images from this server on :5000.
// Serve uploaded product images — restrict CORS to the configured frontend
// origin only, not the open wildcard (*) which lets any site embed your images.
app.use('/uploads', (req, res, next) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — confirms the API is running
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Muhanga Marketplace API is running',
    version: '1.0.0',
    status: 'OK',
  });
});

// Product & category routes
app.use('/api/products',   productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/offers',     offerRoutes);

// Cart routes
app.use('/api/cart', cartRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Order routes (checkout, order management)
app.use('/api/orders', orderRoutes);

// Payment routes (manual/admin payment management)
app.use('/api/payments', paymentRoutes);

// Favorites
app.use('/api/favorites', favoriteRoutes);

// User routes (admin-only customer list)
app.use('/api/users', userRoutes);

// Cleaning Services module
app.use('/api/cleaning-services', serviceRouter);
app.use('/api/cleaners',          cleanerRouter);
app.use('/api/cleaning-requests', requestRouter);

// ─── Future API Route Groups ──────────────────────────────────────────────────
// app.use('/api/deliveries', deliveryRoutes);
// app.use('/api/admin',      adminRoutes);


// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Muhanga Marketplace API');
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
});
