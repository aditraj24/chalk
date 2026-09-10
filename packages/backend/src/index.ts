import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { clerkMiddleware } from '@clerk/express';
import { chatRoutes } from './routes/chats.js';
import { documentRoutes } from './routes/documents.js';
import { messageRoutes } from './routes/messages.js';
import rateLimit from 'express-rate-limit';

import fs from 'fs';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const CLERK_PUBLISHABLE_KEY =
  process.env.CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_ZHluYW1pYy1lYWdsZS0zODU5LmNsZXJrLmFjY291bnRzLmRldiQ';
const CLERK_SECRET_KEY =
  process.env.CLERK_SECRET_KEY ||
  'sk_test_wL9cT6mbVETrUye7htncnate57LJoN3JWrEz612zTu';

process.env.CLERK_PUBLISHABLE_KEY = CLERK_PUBLISHABLE_KEY;
process.env.CLERK_SECRET_KEY = CLERK_SECRET_KEY;

// ─── Global Middleware ─────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin)
    if (!origin || origin === FRONTEND_URL || origin.includes('localhost')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

// ─── Health Check ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rate Limiting ─────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Clerk middleware and rate limiting to /api routes
app.use('/api', apiLimiter, clerkMiddleware({ publishableKey: CLERK_PUBLISHABLE_KEY, secretKey: CLERK_SECRET_KEY }));

// ─── API Routes ────────────────────────────────────────
app.use('/api/chats', chatRoutes);
app.use('/api/chats', documentRoutes);
app.use('/api/chats', messageRoutes);

// ─── Serve Frontend ───────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDist)) {
  console.log(`🌐 Serving frontend SPA from ${frontendDist}`);
  app.use(express.static(frontendDist));

  // SPA fallback — serve index.html for any non-API route with runtime env injection
  app.get('*', (_req, res) => {
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      let html = fs.readFileSync(indexPath, 'utf-8');
      const envScript = `<script>window.__ENV__ = { VITE_CLERK_PUBLISHABLE_KEY: ${JSON.stringify(CLERK_PUBLISHABLE_KEY)} };</script>`;
      html = html.replace('<head>', `<head>${envScript}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } else {
      res.status(404).send('Frontend build not found');
    }
  });
} else {
  console.warn(`⚠️  Frontend dist not found at ${frontendDist}`);
}

// ─── Error Handler ─────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🖍️  Chalk API server running on http://localhost:${PORT}`);
});

export default app;
