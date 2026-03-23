module.exports = function (req, res) {
  var path = req.query.path || '';
  var key = req.query.key || '';
  if (!path || !key) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing path or key' }));
    return;
  }
  var https = require('https');
  var options = {
    hostname: 'api.football-data.org',
    path: '/v4' + path,
    headers: { 'X-Auth-Token': key }
  };
  https.get(options, function (apiRes) {
    var body = '';
    apiRes.on('data', function (c) { body += c; });
    apiRes.on('end', function () {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = apiRes.statusCode;
      res.end(body);
    });
  }).on('error', function (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  });
};
