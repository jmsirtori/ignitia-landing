// Ignitia · Audit Engine — Netlify Serverless Function

const rateLimitStore = new Map();

// Whitelisted IPs
const WHITELIST = ['187.202.199.58'];

function isRateLimited(ip) {
  if (WHITELIST.includes(ip)) return { limited: false };

  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;

  if (rateLimitStore.has(ip)) {
    const lastCall = rateLimitStore.get(ip);
    if (now - lastCall < windowMs) {
      const hoursLeft = Math.ceil((windowMs - (now - lastCall)) / (1000 * 60 * 60));
      return { limited: true, hoursLeft };
    }
  }

  rateLimitStore.set(ip, now);

  // Cleanup
  if (rateLimitStore.size > 100) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (now - val > windowMs) rateLimitStore.delete(key);
    }
  }

  return { limited: false };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Get IP
  const ip =
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['client-ip'] ||
    'unknown';

  const rateCheck = isRateLimited(ip);
  if (rateCheck.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: 'rate_limited',
        hoursLeft: rateCheck.hoursLeft
      })
    };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, url, email } = body;

  if (!name || !url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name or url' }) };
  }

  try {
    new URL(url);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing API key' }) };
  }

  const prompt = `Eres un auditor experto de presencia digital para negocios en Latinoamérica.

Analiza el negocio "${name}" con sitio web "${url}".

Busca información real sobre este negocio en internet. Evalúa:
- Calidad técnica y contenido del sitio web
- Presencia en Google Maps
- Redes sociales
- SEO básico
- Experiencia móvil

Responde SOLO JSON:

{
  "score": <1-10>,
  "problems": [
    {
      "title": "<MAYÚSCULAS>",
      "description": "<MAYÚSCULAS>",
      "severity": "<HIGH o MEDIUM>"
    },
    {
      "title": "<MAYÚSCULAS>",
      "description": "<MAYÚSCULAS>",
      "severity": "<HIGH o MEDIUM>"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', raw);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI error' }) };
    }

    let text = '';
    raw.content.forEach(block => {
      if (block.type === 'text') text += block.text;
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('No JSON found:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid AI format' }) };
    }

    let result;
    try {
      result = JSON.parse(match[0]);
    } catch (e) {
      console.error('JSON parse error:', e, match[0]);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Parse error' }) };
    }

    if (!result.score || !result.problems || result.problems.length < 2) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Incomplete AI response' }) };
    }

    // 🔥 Save lead (non-blocking)
    try {
      const origin = event.headers.origin || 'https://getignitia.com';
      const saveLeadUrl = `${origin}/.netlify/functions/save-lead`;

      fetch(saveLeadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'audit',
          nombre: name,
          correo: email || '',
          negocio: name,
          url: url,
          score: result.score,
          problema_1: result.problems[0]?.title,
          problema_2: result.problems[1]?.title,
          ip
        })
      }).catch(err => console.error('Save lead error:', err));
    } catch (err) {
      console.error('Save lead wrapper error:', err);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Function crash:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error' })
    };
  }
};
