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

5. Нажми **Commit changes**

**Шаг 2:** Теперь нужно обновить admin.html — поменять одну строку. Зайди в файл `admin.html` в репозитории, нажми карандаш (Edit), найди строку:
```
const API='https://api.football-data.org/v4';
```

Замени на:
```
const API='/api/football?path=';
```

И найди строку:
```
const r=await fetch(API+ep,{headers:{'X-Auth-Token':key}});
```

Замени на:
```
const r=await fetch(API+encodeURIComponent(ep)+'&key='+encodeURIComponent(key));
