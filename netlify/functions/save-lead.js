// Ignitia · Save Lead Function

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

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    source = 'unknown',
    nombre = '',
    correo = '',
    negocio = '',
    url = '',
    score = '',
    problema_1 = '',
    problema_2 = '',
    ip = 'unknown'
  } = data;

  const timestamp = new Date().toISOString();

  // 🧠 Log bonito para debugging
  console.log('🔥 NEW LEAD:', {
    source,
    nombre,
    correo,
    negocio,
    url,
    score,
    problema_1,
    problema_2,
    ip,
    timestamp
  });

  // ─────────────────────────────
  // 👉 AQUÍ CONECTAS NOTION / SHEETS
  // ─────────────────────────────

  try {
    // Ejemplo placeholder
    // await fetch('YOUR_NOTION_OR_SHEETS_ENDPOINT', { ... });

  } catch (err) {
    console.error('External save error:', err);
    // No rompemos el flujo
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};
