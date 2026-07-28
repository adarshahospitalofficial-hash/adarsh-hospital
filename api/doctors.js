const https = require('https');

let cachedDoctors = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in-memory cache

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
  res.setHeader('Access-Control-Allow-Origin', 'https://adarsh-hospital.in');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Set Edge CDN caching header for Vercel CDN
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const now = Date.now();
  if (cachedDoctors && (now - lastFetchTime < CACHE_TTL)) {
    res.status(200).json(cachedDoctors);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (cachedDoctors) {
      console.warn('Supabase configuration missing, returning stale in-memory cache.');
      res.status(200).json(cachedDoctors);
    } else {
      res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
    }
    return;
  }

  try {
    const targetUrl = `${supabaseUrl}/rest/v1/doctors?select=*&order=display_order.asc`;
    const response = await makeRequest(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      cachedDoctors = response.body;
      lastFetchTime = now;
      res.status(200).json(cachedDoctors);
    } else {
      console.error('Supabase fetch error for doctors:', response.statusCode, response.body);
      if (cachedDoctors) {
        console.warn('Returning stale in-memory cache due to Supabase error.');
        res.status(200).json(cachedDoctors);
      } else {
        res.status(response.statusCode).json({ error: 'Failed to retrieve doctors from database.' });
      }
    }
  } catch (err) {
    console.error('Error fetching doctors:', err);
    if (cachedDoctors) {
      console.warn('Returning stale in-memory cache due to fetch error.');
      res.status(200).json(cachedDoctors);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
