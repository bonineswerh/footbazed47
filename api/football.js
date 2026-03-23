export default async function handler(req, res) {
  const { path, key } = req.query;
  if (!path || !key) {
    return res.status(400).json({ error: 'Missing path or key' });
  }
  try {
    const response = await fetch(`https://api.football-data.org/v4${path}`, {
      headers: { 'X-Auth-Token': key }
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
```
