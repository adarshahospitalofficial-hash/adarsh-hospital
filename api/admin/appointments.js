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
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
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

  // GET: Fetch appointments with filters
  if (req.method === 'GET') {
    const filter = parsedUrl.query.status || 'all';
    const dateFilter = parsedUrl.query.dateFilter || 'all';

    let targetUrl = `${supabaseUrl}/rest/v1/appointments?select=*&order=created_at.desc`;

    if (dateFilter === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      targetUrl += `&created_at=gte.${encodeURIComponent(startOfToday.toISOString())}`;
    } else if (dateFilter === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      targetUrl += `&created_at=gte.${encodeURIComponent(startOfMonth.toISOString())}`;
    }

    if (filter !== 'all') {
      if (filter === 'pending') {
        targetUrl += `&or=(status.eq.pending,status.is.null)`;
      } else {
        targetUrl += `&status=eq.${filter}`;
      }
    }

    try {
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
      console.error('Fetch appointments error:', err);
      res.status(500).json({ error: 'Internal server error fetching appointments.' });
    }
    return;
  }

  // PATCH: Update appointment status and/or token
  if (req.method === 'PATCH') {
    const { id, status, token_number } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing appointment ID.' });
      return;
    }

    const payload = {};
    if (status !== undefined) payload.status = status;
    if (token_number !== undefined) payload.token_number = token_number;

    try {
      const targetUrl = `${supabaseUrl}/rest/v1/appointments?id=eq.${id}`;
      const response = await makeRequest(targetUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }, payload);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json({ message: 'Appointment updated successfully.' });
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Update appointment error:', err);
      res.status(500).json({ error: 'Internal server error updating status.' });
    }
    return;
  }

  // DELETE: Delete single, selected, or all completed appointments
  if (req.method === 'DELETE') {
    const { deleteType, id, selectedIds } = parsedUrl.query;
    
    let targetUrl = `${supabaseUrl}/rest/v1/appointments`;

    if (deleteType === 'single') {
      if (!id) {
        res.status(400).json({ error: 'Missing ID for single delete.' });
        return;
      }
      targetUrl += `?id=eq.${id}`;
    } else if (deleteType === 'selected') {
      if (!selectedIds) {
        res.status(400).json({ error: 'Missing selected IDs.' });
        return;
      }
      // selectedIds is expected to be comma-separated list: "1,2,3"
      targetUrl += `?id=in.(${selectedIds})`;
    } else if (deleteType === 'all-completed') {
      targetUrl += `?status=eq.completed`;
    } else {
      res.status(400).json({ error: 'Invalid or missing deleteType.' });
      return;
    }

    try {
      const response = await makeRequest(targetUrl, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (response.statusCode >= 200 && response.statusCode < 300) {
        res.status(200).json({ message: 'Appointment(s) deleted successfully.' });
      } else {
        res.status(response.statusCode).json(response.body);
      }
    } catch (err) {
      console.error('Delete appointments error:', err);
      res.status(500).json({ error: 'Internal server error deleting appointments.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
