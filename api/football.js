const https = require('https');

module.exports = function handler(req, res) {
  const path = req.query.path;
  const key = req.query.key;

  if (!path || !key) {
    res.status(400).json({ error: 'Missing path or key' });
    return;
  }

  const options = {
    hostname: 'api.football-data.org',
    path: '/v4' + path,
    method: 'GET',
    headers: { 'X-Auth-Token': key }
  };

  const request = https.request(options, function(response) {
    let body = '';
    response.on('data', function(chunk) { body += chunk; });
    response.on('end', function() {
      try {
        const data = JSON.parse(body);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.statusCode).json(data);
      } catch (e) {
        res.status(500).json({ error: 'Invalid JSON response' });
      }
    });
  });

  request.on('error', function(e) {
    res.status(500).json({ error: e.message });
  });

  request.end();
};
