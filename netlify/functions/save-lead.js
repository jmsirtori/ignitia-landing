// Ignitia · Notion Leads Function
// Guarda leads de audit y contact en Notion

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = '332676f6042380b8a2fbee08e20506f8';

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

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const token = NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Notion token not configured' }) };
  }

  // Build Notion page properties based on source
  const isAudit = body.source === 'audit';

  const properties = {
    // Title — Nombre o Negocio
    'Nombre': {
      title: [{ text: { content: isAudit ? (body.negocio || 'Sin nombre') : (body.nombre || 'Sin nombre') } }]
    },
    'Fuente': {
      select: { name: isAudit ? 'audit' : 'contact' }
    },
    'Fecha': {
      date: { start: new Date().toISOString().split('T')[0] }
    }
  };

  // Audit-specific fields
  if (isAudit) {
    if (body.url)        properties['URL']        = { url: body.url };
    if (body.score)      properties['Score']      = { number: parseFloat(body.score) };
    if (body.problema_1) properties['Problema 1'] = { rich_text: [{ text: { content: body.problema_1 } }] };
    if (body.problema_2) properties['Problema 2'] = { rich_text: [{ text: { content: body.problema_2 } }] };
  }

  // Contact-specific fields
  if (!isAudit) {
    if (body.correo)  properties['Correo']  = { email: body.correo };
    if (body.empresa) properties['Empresa'] = { rich_text: [{ text: { content: body.empresa } }] };
    if (body.problema)properties['Problema 1'] = { rich_text: [{ text: { content: body.problema } }] };
    if (body.negocio_auditado) properties['Negocio'] = { rich_text: [{ text: { content: body.negocio_auditado } }] };
    if (body.url_negocio)      properties['URL']     = { url: body.url_negocio };
    if (body.score_friccion)   properties['Score']   = { number: parseFloat(body.score_friccion) };
  }

  try {
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        properties
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Notion error:', err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Notion API error', detail: err }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
