import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { seedDatabase } from './db/seed.js';
import { authMiddleware } from './middleware/auth.js';
import workItemsRouter from './routes/workItems.js';
import authRouter from './routes/auth.js';
import statsRouter from './routes/stats.js';

dotenv.config();

// Seed initial database
seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Global Auth Middleware
app.use(authMiddleware);

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/work-items', workItemsRouter);
app.use('/api/stats', statsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), system: 'Newtonite Operations API' });
});

// Serve static frontend assets in production build if built
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(process.cwd(), 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR'
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Newtonite Operations Platform running at http://localhost:${PORT}`);
  });
}

export default app;
