module.exports = async function handler(req, res) {
  const { path, key } = req.query;
  if (!path || !key) {
    return res.status(400).json({ error: 'Missing path or key' });
  }
  try {
    const url = 'https://api.football-data.org/v4' + path;
    const response = await fetch(url, {
      headers: { 'X-Auth-Token': key }
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
```
