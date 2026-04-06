// Ignitia · Audit Engine — Netlify Serverless Function
// Rate limiting: 1 audit per IP per 24 hours
// Notion lead saving: inline (no inter-function calls)

const rateLimitStore = new Map();

const WHITELIST = ['187.202.199.58'];

const NOTION_DATABASE_ID = '332676f6042380b8a2fbee08e20506f8';

const ALLOWED_ORIGINS = [
  'https://getignitia.com',
  'https://www.getignitia.com'
];

function isAllowedNetlifyPreview(origin = '') {
  return /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(origin);
}

function getCorsHeaders(event) {
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  let allowedOrigin = 'https://getignitia.com';
  if (ALLOWED_ORIGINS.includes(requestOrigin) || isAllowedNetlifyPreview(requestOrigin)) {
    allowedOrigin = requestOrigin;
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

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
  if (rateLimitStore.size > 100) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (now - val > windowMs) rateLimitStore.delete(key);
    }
  }
  return { limited: false };
}

// Save lead directly to Notion — no inter-function calls
async function saveLeadToNotion({ name, url, email, score, problema1, problema2 }) {
  const token = process.env.NOTION_TOKEN;
  if (!token) { console.error('NOTION_TOKEN not configured'); return; }

  const properties = {
    'Nombre': { title: [{ text: { content: name || 'Sin nombre' } }] },
    'Fuente': { select: { name: 'audit' } },
    'Fecha':  { date:  { start: new Date().toISOString().split('T')[0] } }
  };

  if (url)       properties['URL']        = { url };
  if (email)     properties['Correo']     = { email };
  if (score)     properties['Score']      = { number: parseFloat(score) };
  if (problema1) properties['Problema 1'] = { rich_text: [{ text: { content: problema1 } }] };
  if (problema2) properties['Problema 2'] = { rich_text: [{ text: { content: problema2 } }] };

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DATABASE_ID },
        properties
      })
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('Notion save error:', err);
    }
  } catch (err) {
    console.error('Notion fetch error:', err.message);
  }
}

exports.handler = async (event) => {
  const headers = getCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
  || event.headers['client-ip']
  || 'unknown';

console.log('IP detectada:', ip);
console.log('WHITELIST:', WHITELIST);
console.log('Incluida:', WHITELIST.includes(ip));

  const rateCheck = isRateLimited(ip);
  if (rateCheck.limited) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: 'rate_limited',
        hoursLeft: rateCheck.hoursLeft,
        message: `Ya usaste tu diagnóstico gratuito. Disponible en ${rateCheck.hoursLeft} hrs.`
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, url, email, consentAccepted } = body;

  if (!name || !url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name or url' }) };
  }

  if (consentAccepted !== true) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Consent is required' }) };
  }

  try { new URL(url); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const prompt = `Eres un especialista en estrategia digital y conversión para negocios B2B.

Analiza el negocio "${name}" con sitio web "${url}".

Busca información real en internet y evalúa la presencia digital.

Responde SOLO con JSON válido, sin texto adicional ni backticks:

{
  "score": <1-10 donde 10 = máxima fricción>,
  "problems": [
    {
      "title": "<TÍTULO EN MAYÚSCULAS, MAX 5 PALABRAS>",
      "description": "<PROBLEMA + IMPACTO EN NEGOCIO. MAYÚSCULAS. SIN SOLUCIONES>",
      "severity": "<HIGH o MEDIUM>"
    },
    {
      "title": "<SEGUNDO PROBLEMA>",
      "description": "<ENFOCADO EN PÉRDIDA DE CLARIDAD, CONFIANZA O LEADS>",
      "severity": "<HIGH o MEDIUM>"
    }
  ]
}

Reglas:
- Problemas específicos, no genéricos
- NO soluciones
- Todo en ESPAÑOL y MAYÚSCULAS
- Si el sitio no carga → score 9-10`;

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
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      let err;
      try { err = await response.json(); } catch { err = { message: 'Could not parse error' }; }
      console.error('Anthropic error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'API error', detail: err }) };
    }

    const data = await response.json();

    let text = '';
    for (const block of data.content || []) {
      if (block.type === 'text') text += block.text;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in response:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid response format', raw: text }) };
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid JSON from model' }) };
    }

    if (typeof result.score !== 'number' || !Array.isArray(result.problems) || result.problems.length < 2) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Incomplete response', result }) };
    }

    // Save lead to Notion — fire and forget, inline
    saveLeadToNotion({
      name,
      url,
      email:     email || '',
      score:     String(result.score),
      problema1: result.problems[0]?.title || '',
      problema2: result.problems[1]?.title || ''
    }).catch(err => console.error('Lead save failed:', err));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error', detail: err.message }) };
  }
};
