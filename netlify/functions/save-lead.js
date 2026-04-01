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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let data;
  try {
    data = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const {
    source = 'unknown',
    fuente = '',
    nombre = '',
    correo = '',
    empresa = '',
    problema = '',
    negocio = '',
    negocio_auditado = '',
    url = '',
    url_negocio = '',
    score = '',
    score_friccion = '',
    problema_1 = '',
    problema_2 = '',
    consentimiento = false,
    ip = 'unknown'
  } = data;

  const timestamp = new Date().toISOString();

  const lead = {
    source,
    fuente,
    nombre,
    correo,
    empresa,
    problema,
    negocio,
    negocio_auditado,
    url,
    url_negocio,
    score,
    score_friccion,
    problema_1,
    problema_2,
    consentimiento,
    ip,
    timestamp
  };

  console.log('🔥 NEW LEAD:', lead);

  const notionToken = process.env.NOTION_TOKEN;
  const notionDbId = process.env.NOTION_DB_ID || '332676f6042380b8a2fbee08e20506f8';

  if (notionToken && notionDbId) {
    try {
      const notionPayload = {
        parent: { database_id: notionDbId },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: nombre || negocio || negocio_auditado || empresa || 'Lead sin nombre'
                }
              }
            ]
          },
          Source: {
            rich_text: [{ text: { content: source || fuente || '' } }]
          },
          Email: {
            email: correo || null
          },
          Business: {
            rich_text: [
              {
                text: {
                  content: negocio || negocio_auditado || empresa || ''
                }
              }
            ]
          },
          URL: {
            url: url || url_negocio || null
          },
          Score: {
            rich_text: [
              {
                text: {
                  content: String(score || score_friccion || '')
                }
              }
            ]
          },
          Problem_1: {
            rich_text: [{ text: { content: problema_1 || '' } }]
          },
          Problem_2: {
            rich_text: [{ text: { content: problema_2 || '' } }]
          },
          Consent: {
            checkbox: Boolean(consentimiento)
          },
          Timestamp: {
            date: { start: timestamp }
          },
          Notes: {
            rich_text: [
              {
                text: {
                  content: [
                    problema ? `Problema declarado: ${problema}` : '',
                    ip ? `IP: ${ip}` : ''
                  ].filter(Boolean).join(' | ')
                }
              }
            ]
          }
        }
      };

      const notionRes = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(notionPayload)
      });

      if (!notionRes.ok) {
        const notionErr = await notionRes.text();
        console.error('Notion save error:', notionErr);
      } else {
        console.log('✅ Lead saved to Notion');
      }
    } catch (err) {
      console.error('External save error:', err);
    }
  } else {
    console.log('ℹ️ Notion env vars missing — lead logged only');
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};
