
import { useState } from 'react';
import analyzeWithClaude from './analyzeWithClaude';

const METRIC_LABELS = {
  performance: 'Performance Score',
  fcp: 'First Contentful Paint',
  lcp: 'Largest Contentful Paint',
  tbt: 'Total Blocking Time',
  cls: 'Cumulative Layout Shift',
  speedIndex: 'Speed Index',
};

function getScoreColor(score) {
  if (score >= 90) return 'bg-green-500';
  if (score >= 50) return 'bg-orange-400';
  return 'bg-red-500';
}



function App() {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState('');
  // Gemini AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiOpen, setAiOpen] = useState(true);

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setAiResult('');
    setAiError('');
    setLoading(true);
    setProgress('Fetching data...');
    try {
      let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}`;
      if (apiKey) {
        apiUrl += `&key=${encodeURIComponent(apiKey)}`;
      }
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('API error: ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      setProgress('Processing metrics...');
      const lighthouse = data.lighthouseResult;
      const audits = lighthouse.audits;
      const metrics = {
        performance: Math.round(lighthouse.categories.performance.score * 100),
        fcp: audits['first-contentful-paint'].displayValue,
        lcp: audits['largest-contentful-paint'].displayValue,
        tbt: audits['total-blocking-time'].displayValue,
        cls: audits['cumulative-layout-shift'].displayValue,
        speedIndex: audits['speed-index'].displayValue,
      };
      setResult({ metrics, raw: data, recommendations: lighthouse.audits['diagnostics']?.details?.items?.[0], lighthouse });

      // Claude AI analysis
      setAiLoading(true);
      setAiError('');
      setAiResult('');
      setAiOpen(true);
  const ai = await analyzeWithClaude(lighthouse);
      if (ai) {
        setAiResult(ai);
      } else {
        setAiError('AI analiza trenutno nije dostupna');
      }
      setAiLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to analyze URL');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lighthouse-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Web Performance Analyzer</h1>
  <form onSubmit={handleAnalyze} className="flex flex-col gap-2 mb-4">
          <input
            type="url"
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter URL (e.g., https://example.com)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
            pattern="https?://.+"
            disabled={loading}
          />
          <input
            type="text"
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="API Key (optional, get from Google Cloud)"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={loading}
          />

          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </form>
        {progress && (
          <div className="mb-2 text-blue-600 text-center animate-pulse">{progress}</div>
        )}
        {error && (
          <div className="mb-2 text-red-600 text-center">{error}</div>
        )}
        {result && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {Object.entries(result.metrics).map(([key, value]) => (
                <div
                  key={key}
                  className={`rounded-lg p-4 shadow flex flex-col items-center ${key === 'performance' ? getScoreColor(value) + ' text-white' : 'bg-gray-50'}`}
                >
                  <div className="font-semibold text-lg">{METRIC_LABELS[key]}</div>
                  <div className="text-2xl font-bold mt-1">{value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mb-4"
            >
              Export as JSON
            </button>
            {result.recommendations && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <div className="font-bold mb-1">Recommendations</div>
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result.recommendations, null, 2)}</pre>
              </div>
            )}
            {/* AI Analysis Section */}
            <div className="mt-6">
              <button
                className="flex items-center gap-2 text-lg font-bold mb-2 focus:outline-none"
                onClick={() => setAiOpen((v) => !v)}
                aria-expanded={aiOpen}
                aria-controls="ai-analysis-section"
              >
                <span role="img" aria-label="sparkles">✨</span> AI Analysis
                <span className="ml-2 text-xs">{aiOpen ? 'Sakrij' : 'Prikaži'}</span>
              </button>
              {aiOpen && (
                <div id="ai-analysis-section" className="transition-all">
                  {aiLoading && (
                    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded animate-pulse">
                      <span role="img" aria-label="robot">🤖</span>
                      <span>AI analizira rezultate...</span>
                    </div>
                  )}
                  {aiError && (
                    <div className="p-4 bg-red-100 text-red-700 rounded">{aiError}</div>
                  )}
                  {aiResult && (
                    <div className="p-4 bg-blue-50 rounded whitespace-pre-line">
                      {aiResult}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  <footer className="mt-8 text-gray-400 text-xs text-center">Powered by Google Lighthouse API &middot; {new Date().getFullYear()}</footer>
    </div>
  );
}

export default App;
