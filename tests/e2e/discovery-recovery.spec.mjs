import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const user='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
const matches=Array.from({length:25},(_,i)=>({id:1001+i,competition_id:7,league_name:'Champions League',home_team_name:'Real Madrid',away_team_name:'Opponent '+i,home_club_id:24,away_club_id:2000+i,match_date:`2026-09-${String(i+1).padStart(2,'0')}T19:00:00Z`,status:'finished',home_score:2,away_score:1}));
const feed=matches.map((match,i)=>({rating_id:2001+i,user_id:user,match_id:match.id,match_rating:9,comment:'',created_at:match.match_date,match,user:{username:'bazed',display_name:'Bazed'},is_public:true,like_count:0,comment_count:0,player_highlights:[]}));
const diary=feed.map(r=>({id:r.rating_id,user_id:user,match_id:r.match_id,match_rating:9,is_public:true,created_at:r.created_at,...r.match}));

test.beforeEach(async({page},info)=>{
  const overrides={matches,feed,diary};
  if(info.title.startsWith('club upcoming'))overrides.matches=Array.from({length:7},(_,i)=>({...matches[i],id:3001+i,status:i===6?'live':'scheduled',match_date:`2030-09-${String(20-i).padStart(2,'0')}T19:00:00Z`}));
  await installSupabaseMock(page,overrides);
});

test('club upcoming preview orders live and nearest fixtures before applying its five-row limit',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  const links=page.locator('#clubBody .entity-match-row>a:first-child');
  await expect(links).toHaveCount(5);
  expect(await links.evaluateAll(rows=>rows.map(a=>a.getAttribute('href')))).toEqual(['/match/3007','/match/3006','/match/3005','/match/3004','/match/3003']);
});

async function holdNextRead(page,rpc){
  await page.evaluate(name=>{
    const original=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__readRequests=[];
    window.__FOOTBAZED_TEST_CLIENT__.rpc=async(method,args)=>{
      if(method!==name)return original(method,args);
      window.__readRequests.push(structuredClone(args));
      if(window.__readRequests.length===1)return new Promise(resolve=>{window.__releaseRead=async error=>resolve(error?{data:null,error}:await original(method,args));});
      return original(method,args);
    };
  },rpc);
}

for(const kind of ['overview','diary'])test(`${kind}: keeps the confirmed page on a network failure and retries the exact page`,async({page})=>{
  const overview=kind==='overview',prefix=overview?'statistics':'diary',rows=overview?'.statistics-row':'.rh-row',size=overview?12:8;
  await page.setViewportSize({width:390,height:844});
  await page.goto((overview?'/discover':`/profile/${user}`)+'?__e2e=1');
  const list=page.locator('#'+prefix+'List');
  await expect(list.locator(rows)).toHaveCount(size);
  const initial=await list.innerText();
  await holdNextRead(page,overview?'get_football_statistics':'get_profile_diary');
  await page.locator('#'+prefix+'Next').click();
  await expect(list).toHaveAttribute('aria-busy','true');
  await expect(list).toHaveText(initial,{useInnerText:true});
  await expect(page.locator('#'+prefix+'Page')).toHaveText(`1–${size} из 25`);
  await page.evaluate(()=>window.__releaseRead({code:'',message:'Failed to fetch'}));
  await expect(page.locator('#'+prefix+'Error')).toContainText('Показаны предыдущие результаты');
  await expect(list).toHaveText(initial,{useInnerText:true});
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('#'+prefix+'Page')).toHaveText(`${size+1}–${size*2} из 25`);
  const requests=await page.evaluate(()=>window.__readRequests);
  expect(requests[1]).toEqual(requests[0]);
  await expect(page.locator('#'+prefix+'Title')).toBeFocused();
  await expect.poll(async()=>Math.round((await page.locator('#'+prefix+'Title').boundingBox()).y)).toBeLessThan(180);
  await page.locator('#'+prefix+'Previous').click();
  await expect(page.locator('#'+prefix+'Page')).toHaveText(`1–${size} из 25`);
});

for(const result of ['denied','unavailable'])test(`diary clears retained rows when profile becomes ${result}`,async({page})=>{
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(8);
  await page.evaluate(mode=>{const original=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>name==='get_profile_diary'?Promise.resolve({data:null,error:mode==='denied'?{code:'42501',message:'internal denied detail'}:null}):original(name,args);},result);
  await page.locator('#diaryNext').click();
  await expect(page.locator('#diaryError')).toContainText('Не удалось загрузить историю');
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(0);
  await expect(page.locator('#diaryPage')).toBeEmpty();
  await expect(page.locator('#diaryCount')).toBeEmpty();
  await expect(page.locator('#diaryError')).not.toContainText('internal denied detail');
});

test('a delayed page does not steal focus from search or overwrite a changed filter',async({page})=>{
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row')).toHaveCount(12);
  await holdNextRead(page,'get_football_statistics');
  await page.locator('#statisticsNext').click();
  const search=page.getByRole('searchbox',{name:'Поиск в обзоре'});
  await search.focus();
  await page.evaluate(()=>window.__releaseRead());
  await expect(page.locator('#statisticsPage')).toHaveText('13–24 из 25');
  await expect(search).toBeFocused();
  await holdNextRead(page,'get_football_statistics');
  await page.locator('#statisticsNext').click();
  await search.fill('Opponent 0');
  await expect(page.locator('#statisticsPage')).toHaveText('1–1 из 1');
  await page.evaluate(()=>window.__releaseRead());
  await expect(page.locator('#statisticsPage')).toHaveText('1–1 из 1');
  await expect(search).toBeFocused();
});

test('empty selections can be cleared at the result and numeric errors use the site language',async({page})=>{
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('.diary-month-head strong')).toHaveAttribute('data-tone','elite');
  await page.getByRole('searchbox',{name:'Найти оценённый матч'}).fill('No such fixture');
  await expect(page.locator('#diaryPage')).toHaveText('Нет записей');
  await page.getByRole('button',{name:'Показать всю историю'}).click();
  await expect(page.locator('#diaryPage')).toHaveText('1–8 из 25');
  await page.locator('#diaryFilters-open').click();
  await page.getByLabel('Оценка от',{exact:true}).fill('11');
  await expect(page.locator('#diaryFilters-validation')).toHaveText('Оценка должна быть целым числом от 1 до 10');
  await page.getByRole('button',{name:'Закрыть фильтры'}).click();
  await expect(page.locator('#diaryFilters-inline-validation')).toHaveText('Оценка должна быть целым числом от 1 до 10');
  await page.goto('/discover?__e2e=1&ov_query=Missing');
  await expect(page.locator('.statistics-list')).toContainText('пока нет оценок');
  await page.getByRole('button',{name:'Показать без фильтров'}).click();
  await expect(page.locator('.statistics-row')).toHaveCount(12);
});

test('foreign history uses neutral copy and pagination cannot move focus outside an open dialog',async({page})=>{
  await page.goto(`/profile/${other}?__e2e=1`);
  await expect(page.locator('#diaryFilters-query')).toHaveAttribute('placeholder','Найти в истории');
  await page.locator('#diaryFilters-open').click();
  await expect(page.locator('#diaryFilters-sheet .section-kicker')).toHaveText('История оценок');
  await page.goto(`/profile/${user}?__e2e=1`);
  await expect(page.locator('#diaryList .rh-row')).toHaveCount(8);
  await holdNextRead(page,'get_profile_diary');
  await page.locator('#diaryNext').click();
  await page.locator('#diaryFilters-open').click();
  await page.evaluate(()=>window.__releaseRead());
  await expect(page.locator('#diaryPage')).toHaveText('9–16 из 25');
  expect(await page.locator('#diaryFilters-sheet').evaluate(el=>el.contains(document.activeElement))).toBe(true);
});
