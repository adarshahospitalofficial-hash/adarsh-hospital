const https = require('https');

// In-memory rate limiting map for basic spam protection
const rateLimitMap = new Map();

// Helper to make HTTPS requests
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (e) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
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

// In-memory rate limiting check (3 requests per 5 minutes per IP)
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxRequests = 3;

  // Periodic cleanup to avoid memory leak
  if (rateLimitMap.size > 1000) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const fresh = timestamps.filter(t => now - t < windowMs);
      if (fresh.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, fresh);
      }
    }
  }

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, [now]);
    return false;
  }

  const timestamps = rateLimitMap.get(ip).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return true;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// Allowed services whitelist
const ALLOWED_SERVICES = new Set([
  'General OPD',
  'Executive Master Health Checkup (₹5,000)',
  'Master Health Checkup (₹3,000)',
  'Mini Health Checkup (₹1,500)',
  'Complete Cardiac Package (₹3,000)',
  'Kidney Stone Screening (₹1,500)',
  'Diabetes Screening (₹1,500)',
  'Well Women Checkup (₹4,000)',
  'Infertility Package (Couple)',
  'PCOD Package (₹2,000)',
  'Laboratory / Diagnostics',
  'Radiology / Ultrasound / CT Scan',
  'Cardiology / ECG / ECHO / TMT',
  'Obstetrics & Gynaecology Care',
  'Dialysis Centre',
  'General Medicine',
  'General Surgery',
  'Paediatrics & Child Care'
]);

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://adarsh-hospital.in');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';

    // 1. In-memory Rate Limiting Check
    if (isRateLimited(clientIp)) {
      res.status(429).json({ error: 'Too many requests. Please try again after 5 minutes.' });
      return;
    }

    const {
      full_name,
      phone_number,
      email_address,
      service_requested,
      preferred_doctor,
      message,
      website
    } = req.body || {};

    // 2. Honeypot Check (Spam Bot Protection)
    if (website) {
      console.warn(`Spam bot submission caught by honeypot from IP: ${clientIp}`);
      // Return 200 OK so the spam bot thinks it succeeded, but do not save to database
      res.status(200).json({ success: true, message: 'Callback request submitted successfully! We will get back to you shortly.' });
      return;
    }

    // 3. Sanitization helper (removes HTML/scripts to prevent XSS)
    function sanitize(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/<[^>]*>/g, '').trim();
    }

    const cleanName = sanitize(full_name);
    const cleanPhone = sanitize(phone_number);
    const cleanEmail = sanitize(email_address);
    const cleanService = sanitize(service_requested);
    const cleanDoctor = sanitize(preferred_doctor);
    const cleanMessage = sanitize(message);

    // 4. Input Validations
    if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
      res.status(400).json({ error: 'Please enter a valid full name (2-100 characters).' });
      return;
    }

    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!cleanPhone || !phoneRegex.test(cleanPhone)) {
      res.status(400).json({ error: 'Please enter a valid phone number (7-20 digits).' });
      return;
    }

    const emailRegex = /^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (!cleanService || !ALLOWED_SERVICES.has(cleanService)) {
      res.status(400).json({ error: 'Please select a valid medical service or package.' });
      return;
    }

    if (cleanMessage.length > 1000) {
      res.status(400).json({ error: 'Message is too long. Please restrict it to 1000 characters.' });
      return;
    }

    // 5. Setup Supabase settings (using env variables)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration is missing on the server.' });
      return;
    }

    // 6. DB-based rate limit backup check (if database query is possible)
    // Query last 5 minutes of records for this IP/Phone.
    // (Note: This checks if the same phone number was registered in the last 5 minutes)
    try {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const checkUrl = `${supabaseUrl}/rest/v1/appointments?phone_number=eq.${encodeURIComponent(cleanPhone)}&created_at=gte.${fiveMinsAgo}`;
      const checkRes = await makeRequest(checkUrl, {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      if (checkRes.statusCode === 200 && Array.isArray(checkRes.body) && checkRes.body.length > 0) {
        res.status(429).json({ error: 'A callback request was already submitted from this phone number recently. Please wait a few minutes.' });
        return;
      }
    } catch (dbErr) {
      console.warn('Database rate-limit check skipped/failed:', dbErr.message);
    }

    // 7. Insert the appointment into Supabase
    const payload = {
      full_name: cleanName,
      phone_number: cleanPhone,
      email_address: cleanEmail,
      service_requested: cleanService,
      preferred_doctor: cleanDoctor || null,
      message: cleanMessage || null,
      client_ip: clientIp,
      status: 'pending' // default status
    };

    const insertUrl = `${supabaseUrl}/rest/v1/appointments`;
    const insertRes = await makeRequest(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, payload);

    if (insertRes.statusCode >= 200 && insertRes.statusCode < 300) {
      res.status(200).json({ success: true, message: 'Callback request submitted successfully! We will get back to you shortly.' });
    } else {
      console.error('Supabase write error:', insertRes.statusCode, insertRes.body);
      const dbDetails = (insertRes.body && typeof insertRes.body === 'object') 
        ? (insertRes.body.message || JSON.stringify(insertRes.body)) 
        : String(insertRes.body || '');
      res.status(500).json({ 
        error: `Failed to process request on database. Reason: ${dbDetails || 'Status ' + insertRes.statusCode}. Please try again later.` 
      });
    }
  } catch (err) {
    console.error('Callback function error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
