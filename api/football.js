// Vercel serverless function: /api/football
// Required Vercel environment variables (never put these in app.js/admin.html):
// FOOTBALL_API_KEY (or FOOTBALL_DATA_API_KEY), SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY

const https = require('https');

const ALLOWED_PATH = /^\/competitions\/(PL|PD|SA|BL1|FL1|CL)(?:\/(matches|teams))?(?:\?dateFrom=\d{4}-\d{2}-\d{2}&dateTo=\d{4}-\d{2}-\d{2})?$/;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function requestJson(url, options) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode || 500, body }));
    });
    request.setTimeout(10_000, () => request.destroy(new Error('Upstream request timed out')));
    request.on('error', reject);
    request.end();
  });
}

async function isAdministrator(authorization) {
  if (!authorization || !authorization.startsWith('Bearer ')) return false;
  const token = authorization.slice('Bearer '.length);
  const authResponse = await requestJson(
    `${process.env.SUPABASE_URL}/auth/v1/user`,
    { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization } }
  );
  if (authResponse.status !== 200) return false;
  const user = JSON.parse(authResponse.body);
  const profileResponse = await requestJson(
    `${process.env.SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
    { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  if (profileResponse.status !== 200) return false;
  const profiles = JSON.parse(profileResponse.body);
  return Array.isArray(profiles) && profiles[0] && profiles[0].is_admin === true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const footballApiKey = process.env.FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_API_KEY;
  if (!footballApiKey || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, { error: 'Server environment is not configured' });
  }

  const path = String(req.query.path || '');
  if (!ALLOWED_PATH.test(path)) return json(res, 400, { error: 'Unsupported football-data request' });

  try {
    if (!(await isAdministrator(req.headers.authorization))) return json(res, 403, { error: 'Administrator access required' });
    const upstream = await requestJson(`https://api.football-data.org/v4${path}`, {
      headers: { 'X-Auth-Token': footballApiKey }
    });
    res.status(upstream.status).setHeader('Content-Type', 'application/json');
    res.end(upstream.body);
  } catch (error) {
    json(res, 502, { error: 'Football data service is unavailable' });
  }
};
