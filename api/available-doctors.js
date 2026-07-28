const https = require('https');

let cachedAvailableDoctors = null;
let lastFetchTime = 0;
const CACHE_TTL = 1 * 60 * 1000; // 1 minute in-memory cache for available doctors

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
  if (cachedAvailableDoctors && (now - lastFetchTime < CACHE_TTL)) {
    res.status(200).json(cachedAvailableDoctors);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    if (cachedAvailableDoctors) {
      console.warn('Supabase configuration missing, returning stale in-memory cache.');
      res.status(200).json(cachedAvailableDoctors);
    } else {
      res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
    }
    return;
  }

  try {
    const targetUrl = `${supabaseUrl}/rest/v1/doctors?select=name,is_available&is_available=eq.true&order=name.asc`;
    const response = await makeRequest(targetUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      cachedAvailableDoctors = response.body;
      lastFetchTime = now;
      res.status(200).json(cachedAvailableDoctors);
    } else {
      console.error('Supabase fetch error for available doctors:', response.statusCode, response.body);
      if (cachedAvailableDoctors) {
        console.warn('Returning stale in-memory cache due to Supabase error.');
        res.status(200).json(cachedAvailableDoctors);
      } else {
        res.status(response.statusCode).json({ error: 'Failed to retrieve available doctors from database.' });
      }
    }
  } catch (err) {
    console.error('Error fetching available doctors:', err);
    if (cachedAvailableDoctors) {
      console.warn('Returning stale in-memory cache due to fetch error.');
      res.status(200).json(cachedAvailableDoctors);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};
