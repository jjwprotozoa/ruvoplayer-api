import cors from 'cors';
import express from 'express';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import xtreamHandler from './xtream.js';

// Polyfill fetch for Node.js (if not available)
if (!globalThis.fetch) {
  const { default: fetch } = await import('node-fetch');
  globalThis.fetch = fetch;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route for Vercel
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Ruvo Player Backup API is running',
    endpoints: {
      parse: '/parse',
      xtream: '/xtream',
      stalker: '/stalker',
      health: '/health'
    }
  });
});

// Convert Vercel serverless functions to Express routes
app.get('/api/xtream', async (req, res) => {
  // Mock the Vercel request/response objects
  const vercelReq = {
    method: req.method,
    query: req.query,
    headers: req.headers
  };
  
  const vercelRes = {
    setHeader: (name, value) => res.set(name, value),
    status: (code) => ({ json: (data) => res.status(code).json(data), end: () => res.status(code).end() }),
    statusCode: 200
  };
  
  await xtreamHandler(vercelReq, vercelRes);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ruvo Player Backup API is running' });
});

// Start server (only for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Ruvo Player API server running on http://localhost:${PORT}`);
    console.log(`📡 Xtream endpoint: http://localhost:${PORT}/api/xtream`);
  });
}

export default app;
