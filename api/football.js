// /api/football.js
module.exports = async function handler(req, res) {
  // ✅ CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // ✅ Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // ✅ Только GET запросы
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { path, key } = req.query;
  
  // ✅ Валидация параметров
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }
  
  if (!key) {
    return res.status(400).json({ error: 'Missing API key' });
  }
  
  // ✅ Проверка формата пути (безопасность)
  if (!path.match(/^[a-z0-9\/\-_]+$/i)) {
    return res.status(400).json({ error: 'Invalid path format' });
  }
  
  try {
    // ✅ Исправленный URL (без пробелов!)
    const url = `https://api.football-data.org/v4/${path.replace(/^\//, '')}`;
    
    console.log('📡 Запрос к:', url);
    
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': key,
        'Content-Type': 'application/json'
      },
      // ✅ Кэширование на 5 минут
      next: { revalidate: 300 }
    });
    
    const data = await response.json();
    
    // ✅ Логирование ошибок
    if (!response.ok) {
      console.error('❌ API Error:', response.status, data);
    }
    
    return res.status(response.status).json(data);
    
  } catch (e) {
    console.error('❌ Server Error:', e.message);
    return res.status(500).json({ 
      error: 'Failed to fetch data',
      details: e.message 
    });
  }
};
