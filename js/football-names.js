(function(root,factory){
  'use strict';
  const api=factory(root?.FBZDomain||(typeof module==='object'?require('./domain.js'):null),()=>root?.FBZLocale?.language||'ru');
  if(root)root.FBZNames=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?null:window,function(domain,language){
  'use strict';
  // Curated display names; IDs and the provider catalogue remain unchanged.
  const rows=`Real Madrid|Реал Мадрид
Man City|Ман Сити|Манчестер Сити
Barcelona|Барселона
Atlético Madrid|Атлетико|Атлетико Мадрид
PSG|ПСЖ|Пари Сен-Жермен
Brighton|Брайтон|Брайтон энд Хоув Альбион
Liverpool|Ливерпуль
Arsenal|Арсенал
Man United|Ман Юнайтед|Манчестер Юнайтед
Chelsea|Челси
Tottenham|Тоттенхэм
Aston Villa|Астон Вилла
West Ham|Вест Хэм
Burnley|Бернли
Brentford|Брентфорд
Bournemouth|Борнмут
Wolves|Вулверхэмптон
Fulham|Фулхэм
Newcastle|Ньюкасл
Nottingham Forest|Ноттингем Форест
Sunderland|Сандерленд
Leeds|Лидс
Everton|Эвертон
Crystal Palace|Кристал Пэлас
Coventry|Ковентри
Hull City|Халл Сити
Ipswich|Ипсвич
Athletic Club|Атлетик|Атлетик Бильбао
Osasuna|Осасуна
Alavés|Алавес
Elche|Эльче
Getafe|Хетафе
Girona|Жирона
Levante|Леванте
Rayo Vallecano|Райо Вальекано
Celta|Сельта
Espanyol|Эспаньол
Mallorca|Мальорка
Real Betis|Бетис|Реал Бетис
Real Sociedad|Реал Сосьедад
Real Oviedo|Реал Овьедо
Sevilla|Севилья
Valencia|Валенсия
Villarreal|Вильярреал
Málaga|Малага
Deportivo|Депортиво|Депортиво Ла-Корунья
Racing Santander|Расинг|Расинг Сантандер
Bayern|Бавария
Dortmund|Боруссия Д|Боруссия Дортмунд
Mönchengladbach|Боруссия М|Боруссия Мёнхенгладбах
Leverkusen|Байер|Байер Леверкузен
RB Leipzig|РБ Лейпциг
Frankfurt|Айнтрахт|Айнтрахт Франкфурт
Wolfsburg|Вольфсбург
Werder Bremen|Вердер
Stuttgart|Штутгарт
Hoffenheim|Хоффенхайм
Mainz|Майнц
Köln|Кёльн
Union Berlin|Унион Берлин
Heidenheim|Хайденхайм
Freiburg|Фрайбург
Augsburg|Аугсбург
Hamburg|Гамбург
St. Pauli|Санкт-Паули
Schalke|Шальке
Paderborn|Падерборн
Elversberg|Эльверсберг
AC Milan|Милан
Inter|Интер
Juventus|Ювентус
Napoli|Наполи
Atalanta|Аталанта
Bologna|Болонья
Roma|Рома
Lazio|Лацио
Fiorentina|Фиорентина
Como|Комо
Cagliari|Кальяри
Genoa|Дженоа
Verona|Верона
Parma|Парма
Udinese|Удинезе
Torino|Торино
Sassuolo|Сассуоло
Lecce|Лечче
Cremonese|Кремонезе
Pisa|Пиза
Marseille|Марсель
Lyon|Лион
Monaco|Монако
Lille|Лилль
Lens|Ланс
Nice|Ницца
Rennes|Ренн
Brest|Брест
Strasbourg|Страсбур
Toulouse|Тулуза
Le Havre|Гавр
Nantes|Нант
Auxerre|Осер
Angers|Анже
Lorient|Лорьян
Metz|Мец
Paris FC|Париж
Troyes|Труа
Le Mans|Ле-Ман
Ajax|Аякс
PSV|ПСВ
Benfica|Бенфика
Sporting CP|Спортинг
Club Brugge|Брюгге
Union SG|Юнион|Юнион Сен-Жиллуаз
Copenhagen|Копенгаген
Bodø/Glimt|Будё-Глимт
Kairat|Кайрат
Galatasaray|Галатасарай
Olympiacos|Олимпиакос
Paphos|Пафос
Qarabağ|Карабах
Slavia Prague|Славия|Славия Прага
Monza|Монца
Porto|Порту
Fenerbahçe|Фенербахче
Feyenoord|Фейеноорд
Shakhtar|Шахтёр|Шахтёр Донецк
Frosinone|Фрозиноне
LASK|ЛАСК
AEK Athens|АЕК|АЕК Афины
Sabah|Сабах
Slovan Bratislava|Слован|Слован Братислава
Venezia|Венеция
Viking|Викинг
Zenit|Зенит
Spartak Moscow|Спартак|Спартак Москва
Dynamo Moscow|Динамо Москва
Krasnodar|Краснодар`.split('\n').map(row=>{const values=row.split('|');return [domain.canonicalClubName(values[0]),...values];});
  const key=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/gu,'е').trim();
  const names=new Map(rows.flatMap(row=>row.filter(Boolean).map(name=>[key(name),row])));
  function canonical(value){const raw=typeof value==='object'?value?.name:value;return names.get(key(raw))?.[0]||domain.canonicalClubName(raw);}
  function club(value,fallback='',full=false,lang=language()){
    const raw=typeof value==='object'?(value?.name||value?.short_name):value;
    const row=names.get(key(raw))||names.get(key(domain.canonicalClubName(raw)))||names.get(key(fallback));
    return row?(lang==='en'?(full&&!/[А-Яа-яЁё]/u.test(row[0])?row[0]:row[1]):full?(row[3]||row[2]):row[2]):String((full?raw:typeof value==='object'?value?.short_name||raw:raw)||fallback||(lang==='en'?'Club':'Клуб'));
  }
  const competitions=[['CL','UEFA Champions League','Лига чемпионов','Champions League'],['PL','Premier League','АПЛ','Английская Премьер-лига'],['PD','La Liga','Ла Лига','Primera Division'],['BL1','Bundesliga','Бундеслига'],['SA','Serie A','Серия А'],['FL1','Ligue 1','Лига 1'],['EL','UEFA Europa League','Лига Европы','Europa League']];
  function competition(value,lang=language()){
    const raw=typeof value==='object'?value?.name:value,code=typeof value==='object'?value?.code:'';
    const row=competitions.find(row=>row[0]===code&&code||row.some(name=>key(name)===key(raw)));
    return row?(lang==='en'?row[1]:row[2]):String(raw||'');
  }
  function matchTitle(value,lang=language()){
    if(typeof value==='object')return club(value.home_club,value.home_team_name,false,lang)+' — '+club(value.away_club,value.away_team_name,false,lang);
    return String(value||'').replaceAll(' вЂ” ',' — ').split(' — ').map(name=>club(name,'',false,lang)).join(' — ');
  }
  return Object.freeze({club,competition,canonical,matchTitle,rows});
});
