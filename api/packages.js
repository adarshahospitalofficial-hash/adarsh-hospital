const https = require('https');

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (e) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          body: parsed
        });
      });
    });
    req.on('error', (err) => reject(err));
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
    return;
  }

  try {
    const targetUrl = `${supabaseUrl}/rest/v1/packages?select=*&order=price.desc`;
    const response = await makeRequest(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      res.status(200).json(response.body);
    } else {
      console.error('Supabase fetch error for packages:', response.statusCode, response.body);
      res.status(response.statusCode).json({ error: 'Failed to retrieve packages from database.' });
    }
  } catch (err) {
    console.error('Error fetching packages:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
