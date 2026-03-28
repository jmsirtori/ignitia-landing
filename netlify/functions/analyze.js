// Ignitia · Audit Engine — Netlify Serverless Function
// Rate limiting: 1 audit per IP per 24 hours

const rateLimitStore = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000; // 24 hours

  if (rateLimitStore.has(ip)) {
    const lastCall = rateLimitStore.get(ip);
    if (now - lastCall < windowMs) {
      const hoursLeft = Math.ceil((windowMs - (now - lastCall)) / (1000 * 60 * 60));
      return { limited: true, hoursLeft };
    }
  }

  rateLimitStore.set(ip, now);

  // Cleanup old entries every 100 requests
  if (rateLimitStore.size > 100) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (now - val > windowMs) rateLimitStore.delete(key);
    }
  }

  return { limited: false };
}

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://getignitia.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Get client IP
  const ip = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';

  // Check rate limit
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

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, url } = body;
  if (!name || !url) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing name or url' }) };
  }

  // Validate URL format
  try { new URL(url); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) };
  }

  // Call Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const prompt = `Eres un auditor experto de presencia digital para negocios en Latinoamérica.

Analiza el negocio "${name}" con sitio web "${url}".

Busca información real sobre este negocio en internet. Evalúa:
- Calidad técnica y contenido del sitio web
- Presencia y reseñas en Google Maps
- Redes sociales activas y engagement
- Posicionamiento SEO básico
- Velocidad y experiencia móvil

Responde ÚNICAMENTE con JSON válido sin texto adicional ni backticks markdown:

{
  "score": <número entero del 1 al 10, donde 10 es máxima fricción y problemas>,
  "problems": [
    {
      "title": "<TÍTULO CORTO EN MAYÚSCULAS, MÁXIMO 5 PALABRAS>",
      "description": "<DESCRIPCIÓN DEL PROBLEMA EN 1-2 ORACIONES EN MAYÚSCULAS. NO MENCIONES SOLUCIONES.>",
      "severity": "<HIGH o MEDIUM>"
    },
    {
      "title": "<TÍTULO DEL SEGUNDO PROBLEMA>",
      "description": "<DESCRIPCIÓN DEL SEGUNDO PROBLEMA SIN SOLUCIÓN.>",
      "severity": "<HIGH o MEDIUM>"
    }
  ]
}

Reglas críticas:
- Los problemas deben ser REALES y ESPECÍFICOS para este negocio
- NUNCA menciones cómo resolver los problemas
- Todo texto en ESPAÑOL y MAYÚSCULAS
- Sé directo y específico, no genérico
- Si el sitio no carga o no existe, score 9-10 y problemas de accesibilidad`;

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
      const err = await response.json();
      console.error('Anthropic error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'API error', detail: err }) };
    }

    const data = await response.json();

    // Extract text blocks only
    let text = '';
    for (const block of data.content) {
      if (block.type === 'text') text += block.text;
    }

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in response:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid response format' }) };
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!result.score || !result.problems || result.problems.length < 2) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Incomplete response' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error', detail: err.message })
    };
  }
};
