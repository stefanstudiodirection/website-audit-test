// Claude AI analysis for Lighthouse results
// Usage: import analyzeWithClaude from './analyzeWithClaude';


export default async function analyzeWithClaude(lighthouseResults) {
  const prompt = `You are a web performance expert. Analyze these Google Lighthouse performance results and provide a clear explanation in Serbian language. Include:\n- Overall performance summary\n- What each score means (Performance, FCP, LCP, TBT, CLS, Speed Index)\n- Top 3 specific recommendations to improve the score\n- Priority level for each recommendation (High/Medium/Low)\n\nKeep the explanation concise but actionable. Use simple language that non-technical users can understand.\n\nResults: ${JSON.stringify(lighthouseResults)}`;

  try {
  const response = await fetch('http://localhost:4001/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    });
    if (!response.ok) throw new Error('Gemini proxy error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    return null;
  }
}
