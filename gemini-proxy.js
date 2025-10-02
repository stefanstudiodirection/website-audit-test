
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
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    console.log('PageSpeed API status:', response.status);
    console.log('PageSpeed API body:', text);
    if (!response.ok) {
      return res.status(response.status).json({ error: data, status: response.status });
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Proxy za Gemini
// Helper: create a small, human-readable Lighthouse summary
function extractLighthouseSummary(lhr) {
  // Support both raw pagespeed response and lighthouseResult shape
  const root = lhr.lighthouseResult ? lhr.lighthouseResult : lhr;
  const summary = { url: (root.finalUrl || root.requestedUrl || root.url) };

  try {
    const categories = root.categories || (root.categoryGroups ? root.categoryGroups : null);
    if (root.categories && root.categories.performance) {
      summary.performanceScore = root.categories.performance.score;
    } else if (root.categories && typeof root.categories === 'object') {
      // try to find any performance score
      const perf = Object.values(root.categories).find(c => c && c.id === 'performance');
      if (perf && perf.score) summary.performanceScore = perf.score;
    }

    const audits = root.audits || {};
    const metricKeys = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'total-blocking-time',
      'cumulative-layout-shift',
      'speed-index',
      'interactive'
    ];
    summary.metrics = {};
    metricKeys.forEach(k => {
      if (audits[k] && (audits[k].numericValue !== undefined || audits[k].displayValue !== undefined)) {
        summary.metrics[k] = audits[k].numericValue !== undefined ? audits[k].numericValue : audits[k].displayValue;
      }
    });

    // Opportunities: collect audits with details.type === 'opportunity' or with a significant numericValue
    const opportunities = [];
    for (const [key, audit] of Object.entries(audits)) {
      if (!audit) continue;
      if (audit.details && audit.details.type === 'opportunity') {
        opportunities.push({ id: key, title: audit.title || audit.name, wasted: audit.details && audit.details.overallSavingsMs ? audit.details.overallSavingsMs : audit.numericValue || 0 });
      } else if (audit.score !== undefined && audit.score < 0.9 && audit.title) {
        // treat low-scoring audits as opportunities/failures
        opportunities.push({ id: key, title: audit.title, score: audit.score });
      }
    }
    // sort and limit
    opportunities.sort((a, b) => (b.wasted || 0) - (a.wasted || 0));
    summary.opportunities = opportunities.slice(0, 8);

    // Top third-party domains (if available via entities or third-party summary)
    const entities = root.entities || null;
    if (entities && Array.isArray(entities)) {
      summary.thirdParties = entities.slice(0, 8).map(e => ({ name: e.name, origins: e.origins && e.origins.slice(0,2) }));
    }
  } catch (e) {
    // best-effort; don't fail
    summary._extractError = e.message;
  }

  return summary;
}

function buildPromptFromSummary(summary, instructions) {
  const lines = [];
  lines.push(`URL: ${summary.url || 'unknown'}`);
  if (summary.performanceScore !== undefined) lines.push(`Performance score: ${summary.performanceScore}`);
  if (summary.metrics) {
    lines.push('Key metrics:');
    for (const [k, v] of Object.entries(summary.metrics)) {
      lines.push(` - ${k}: ${v}`);
    }
  }
  if (summary.opportunities && summary.opportunities.length) {
    lines.push('Top opportunities / failing audits:');
    summary.opportunities.forEach(o => {
      const note = o.wasted ? ` (wasted ~${o.wasted})` : (o.score !== undefined ? ` (score ${o.score})` : '');
      lines.push(` - ${o.title || o.id}${note}`);
    });
  }
  if (summary.thirdParties) {
    lines.push('Top 3rd-party entities:');
    summary.thirdParties.forEach(t => lines.push(` - ${t.name} ${t.origins ? t.origins.join(', ') : ''}`));
  }

  lines.push('');
  lines.push(instructions || 'Provide a concise, prioritized list of recommendations (max 10 bullets). Keep each bullet short and actionable.');

  return lines.join('\n');
}

app.post('/api/gemini', async (req, res) => {
  try {
    // Backwards-compatible: if prompt string is passed, use it directly
    if (req.body.prompt && typeof req.body.prompt === 'string') {
      const prompt = req.body.prompt;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const data = await response.json();
      return res.json(data);
    }

    // If caller passes a Lighthouse JSON, summarize it server-side and build a small prompt
    const lh = req.body.lighthouse || req.body.lhr || req.body.pagespeed;
    if (!lh) return res.status(400).json({ error: 'Missing prompt or lighthouse payload' });

    const summary = extractLighthouseSummary(lh);
    const instructions = req.body.instructions || 'Act as an expert web performance engineer. Provide prioritized, actionable recommendations in short bullets.';
    let promptText = buildPromptFromSummary(summary, instructions);

    // safety guard: if still too long, trim strictly to metrics + 3 top ops
    if (promptText.length > 15000) {
      const tiny = {
        url: summary.url,
        perf: summary.performanceScore,
        metrics: summary.metrics,
        topOp: summary.opportunities && summary.opportunities.slice(0,3)
      };
      promptText = buildPromptFromSummary(tiny, instructions + ' (trimmed)');
    }

    console.log('Sending trimmed prompt to Gemini, length:', promptText.length);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      }
    );

        // use fetchWithRetries to handle transient 429/503 errors
        const aiResp = await fetchWithRetries(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
          },
          3
        );

        const data = await aiResp.json();
    // If the AI API returns an error that suggests quota or size issues, include the summary in the response for debugging
    if (!response.ok) {
      return res.status(response.status).json({ error: data, summaryLength: promptText.length, summary });
    }

    res.json({ ai: data, summaryLength: promptText.length, summary });
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// fetch with retries + exponential backoff + jitter
async function fetchWithRetries(url, options = {}, maxAttempts = 3) {
  const baseDelay = 500; // ms
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      console.log(`Gemini fetch attempt ${attempt} -> ${url}`);
      const resp = await fetch(url, options);
      // Successful (2xx)
      if (resp.ok) return resp;

      // Retry on 429, 503, or 5xx
      if (resp.status === 429 || resp.status === 503 || (resp.status >= 500 && resp.status < 600)) {
        const bodyText = await resp.text();
        console.warn(`Gemini attempt ${attempt} received ${resp.status}. body: ${bodyText.slice(0,200)}`);
        lastErr = new Error(`HTTP ${resp.status}: ${bodyText}`);
      } else {
        // non-retriable error, re-create Response for caller
        return resp;
      }
    } catch (err) {
      console.warn(`Gemini attempt ${attempt} failed: ${err.message}`);
      lastErr = err;
    }

    if (attempt < maxAttempts) {
      const jitter = Math.random() * 300;
      const delay = Math.pow(2, attempt - 1) * baseDelay + jitter;
      console.log(`Waiting ${Math.round(delay)}ms before retrying (attempt ${attempt + 1}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // exhausted
  throw lastErr || new Error('fetchWithRetries: exhausted attempts');
}

app.listen(PORT, () => {
  console.log(`Gemini proxy server running on http://localhost:${PORT}`);
});
