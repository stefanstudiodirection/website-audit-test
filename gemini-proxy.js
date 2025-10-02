
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY;

// Middleware mora biti pre svih ruta!
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Proxy za PageSpeed Insights
app.post('/api/pagespeed', async (req, res) => {
  try {
    console.log('req.body:', req.body);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${encodeURIComponent(PAGESPEED_API_KEY)}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Proxy za Gemini
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Gemini proxy server running on http://localhost:${PORT}`);
});
