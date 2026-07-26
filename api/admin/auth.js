const https = require('https');

function makeRequest(url, options, data = null) {
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
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

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

  // GET: Verify session via Authorization header
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing token.' });
      return;
    }
    const token = authHeader.split(' ')[1];
    
    try {
      const response = await makeRequest(`${supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.statusCode === 200) {
        res.status(200).json({ user: response.body });
      } else {
        res.status(401).json({ error: 'Session expired or invalid.' });
      }
    } catch (err) {
      console.error('Session verify error:', err);
      res.status(500).json({ error: 'Internal server error verifying session.' });
    }
    return;
  }

  // POST: Login with Email & Password
  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    try {
      const targetUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
      const response = await makeRequest(targetUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        }
      }, { email, password });

      if (response.statusCode === 200 || response.statusCode === 201) {
        res.status(200).json(response.body);
      } else {
        const errMsg = response.body && response.body.error_description 
          ? response.body.error_description 
          : 'Invalid login credentials.';
        res.status(response.statusCode).json({ error: errMsg });
      }
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error during login.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
