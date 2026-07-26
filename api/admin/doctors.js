const https = require('https');
const url = require('url');

function makeRequest(targetUrl, options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(targetUrl, options, (res) => {
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

async function verifyAuth(req, supabaseUrl, supabaseKey) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
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
      return response.body; // user object
    }
  } catch (err) {
    console.error('Auth verification failed in endpoint:', err);
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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

  // Verify auth session
  const user = await verifyAuth(req, supabaseUrl, supabaseKey);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Session is invalid or expired.' });
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // GET: Fetch all doctors for management
  if (req.method === 'GET') {
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
        res.status(200).json(response.body);
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Fetch doctors error:', err);
      res.status(500).json({ error: 'Internal server error fetching doctors.' });
    }
    return;
  }

  // POST: Add a new doctor to the registry
  if (req.method === 'POST') {
    const { name, department, education, description, display_order } = req.body || {};
    if (!name || !department) {
      res.status(400).json({ error: 'Missing name or department.' });
      return;
    }
    try {
      const targetUrl = `${supabaseUrl}/rest/v1/doctors`;
      const response = await makeRequest(targetUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }, { name, department, education, description, display_order, is_available: true });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json({ message: 'Doctor added successfully.' });
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Insert doctor error:', err);
      res.status(500).json({ error: 'Internal server error adding doctor.' });
    }
    return;
  }

  // PATCH: Update doctor availability status
  if (req.method === 'PATCH') {
    const { name, is_available } = req.body || {};
    if (!name || is_available === undefined) {
      res.status(400).json({ error: 'Missing doctor name or is_available status.' });
      return;
    }

    try {
      const targetUrl = `${supabaseUrl}/rest/v1/doctors?name=eq.${encodeURIComponent(name)}`;
      const response = await makeRequest(targetUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }, { is_available });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json({ message: 'Doctor availability updated successfully.' });
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Update doctor error:', err);
      res.status(500).json({ error: 'Internal server error updating doctor availability.' });
    }
    return;
  }

  // DELETE: Remove a doctor from the registry by ID
  if (req.method === 'DELETE') {
    const { id } = parsedUrl.query;
    if (!id) {
      res.status(400).json({ error: 'Missing doctor ID.' });
      return;
    }
    try {
      const targetUrl = `${supabaseUrl}/rest/v1/doctors?id=eq.${id}`;
      const response = await makeRequest(targetUrl, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json({ message: 'Doctor deleted successfully.' });
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Delete doctor error:', err);
      res.status(500).json({ error: 'Internal server error deleting doctor.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
