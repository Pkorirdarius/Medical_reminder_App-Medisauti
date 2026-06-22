const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GITHUB_PAT = process.env.EXPO_PUBLIC_GITHUB_PAT || '';

const SYSTEM_PROMPT = `You are a medical OCR parser. Given raw OCR text from a medication label, extract and return ONLY valid JSON with these fields:
{
  "drugName": "string — medication name, properly capitalized",
  "dosage": "string — e.g. 500mg, 10ml, 1 tablet",
  "frequency": "string — e.g. Once daily, Twice daily, Thrice daily, Four times daily",
  "times": ["array of strings in HH:MM format — infer from frequency if not explicit"]
}

Rules:
- Infer times from frequency if not present: once → ["08:00"], twice → ["08:00","20:00"], thrice → ["08:00","14:00","20:00"]
- Return ONLY the JSON object, no markdown, no explanation
- If you cannot parse anything, return {"drugName":"","dosage":"","frequency":"","times":[]}`;

export function hasProvider() {
  return !!(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here')
      || !!(GITHUB_PAT && GITHUB_PAT !== 'your_github_pat_here');
}

export function getProvider() {
  if (GITHUB_PAT && GITHUB_PAT !== 'your_github_pat_here') return 'GitHub';
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') return 'Gemini';
  return null;
}

function buildUserPrompt(rawText) {
  return `Extract medication details from this OCR text: "${rawText}"

Return a JSON object with these fields:
- drugName: the medication name
- dosage: strength or amount (e.g. 500mg, 10ml)
- frequency: how often (e.g. Once daily, Twice daily)
- times: array of 24h times (HH:MM). Infer from frequency if not explicit: once->["08:00"], twice->["08:00","20:00"], thrice->["08:00","14:00","20:00"]

Return only the JSON object, no other text. If unclear, return {"drugName":"","dosage":"","frequency":"","times":[]}`;
}

async function parseWithGitHub(rawText) {
  const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GITHUB_PAT}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: buildUserPrompt(rawText) },
      ],
      temperature: 0.1,
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('GitHub Models API error:', res.status, err);
    return null;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function parseWithGemini(rawText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT },
          { text: `Raw OCR text:\n${rawText}` },
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('Gemini API error:', res.status, err);
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function parseWithAI(rawText) {
  if (!hasProvider()) return null;

  try {
    if (GITHUB_PAT && GITHUB_PAT !== 'your_github_pat_here') {
      return await parseWithGitHub(rawText);
    }
    return await parseWithGemini(rawText);
  } catch (e) {
    console.warn('AI parse failed:', e);
    return null;
  }
}
