import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

async function setup(page,language='ru'){
  await installSupabaseMock(page);
  await page.addInitScript(()=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__categoryCalls=[];window.__categoryFailure=false;window.__categoryHold=false;
    const players=Array.from({length:30},(_,n)=>({entity_type:'player',entity_id:String(5290+n),title:'Test Player '+String(n+1).padStart(2,'0'),subtitle:'Real Madrid',meta:'CM',relevance:.95}));
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name!=='search_footbazed_page')return rpc(name,args);
      window.__categoryCalls.push(structuredClone(args));
      if(window.__categoryFailure)return Promise.resolve({data:null,error:{code:window.__categoryFailure===true?'NETWORK':window.__categoryFailure}});
      const start=args.p_cursor?Number(args.p_cursor.id)-5290+1:0;
      const items=args.p_kind==='player'?players.slice(start,start+args.p_limit):args.p_kind==='match'?[
        {entity_type:'match',entity_id:'101',title:'Real Madrid CF — Man City',subtitle:'Champions League',meta:'finished',match_date:'2026-09-19T20:00:00Z',home_score:0,away_score:0},
        {entity_type:'match',entity_id:'102',title:'Real Madrid CF — Man City',subtitle:'Champions League',meta:'scheduled',match_date:'2026-10-10T20:00:00Z',home_score:0,away_score:0}
      ]:[];
      const last=items.at(-1);
      const data={items,next_cursor:args.p_kind==='player'&&start+items.length<players.length?{query:args.p_query.toLowerCase(),kind:args.p_kind,relevance:last.relevance,title:last.title,id:last.entity_id}:null};
      if(window.__categoryHold)return new Promise(resolve=>window.__releaseCategory=()=>resolve({data,error:null}));
      return Promise.resolve({data,error:null});
    };
  });
  await page.goto((language==='en'?'/en':'/')+'?__e2e=1');
  await page.locator('#globalSearchBtn').click();
}
const category=(page,kind)=>page.locator('.search-categories button').filter({hasText:kind});

test('category search pages beyond the preview, preserves cursor and focuses the first new result',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
  await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(1);
  await category(page,'Игроки').click();await expect(page.getByRole('option')).toHaveCount(14);
  await expect(category(page,'Игроки')).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>window.__categoryCalls[0])).toEqual({p_query:'Real',p_limit:14,p_kind:'player',p_cursor:null});
  await page.getByRole('button',{name:'Показать ещё',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(28);
  await expect(page.getByRole('option').nth(14)).toBeFocused();
  await page.getByRole('button',{name:'Показать ещё',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(30);
  await expect(page.getByText('Все совпадения загружены')).toBeVisible();
  expect(new Set(await page.locator('.search-result-copy strong').allTextContents()).size).toBe(30);
  expect(await page.evaluate(()=>window.__categoryCalls.map(c=>c.p_cursor?.id||null))).toEqual([null,'5303','5317']);
  expect(errors).toEqual([]);
});

test('failed continuation preserves visible results and retries the same cursor',async({page})=>{
  await setup(page);await category(page,'Игроки').click();await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(14);
  await page.evaluate(()=>window.__categoryFailure=true);await page.getByRole('button',{name:'Показать ещё',exact:true}).click();
  await expect(page.getByRole('option')).toHaveCount(14);await expect(page.getByText('Не удалось загрузить продолжение')).toBeVisible();
  await page.evaluate(()=>window.__categoryFailure=false);await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(28);
  expect(await page.evaluate(()=>JSON.stringify(window.__categoryCalls[1].p_cursor)===JSON.stringify(window.__categoryCalls[2].p_cursor))).toBe(true);
});

test('switching category discards an older pending page rather than filtering the preview',async({page})=>{
  await setup(page);await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(1);
  await page.evaluate(()=>window.__categoryHold=true);await category(page,'Игроки').click();
  await expect.poll(()=>page.evaluate(()=>typeof window.__releaseCategory)).toBe('function');
  await page.evaluate(()=>window.__categoryHold=false);await category(page,'Матчи').click();await expect(page.getByRole('option')).toHaveCount(2);
  await page.evaluate(()=>window.__releaseCategory());await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.search-result-copy strong')).toHaveText(['Реал Мадрид — Ман Сити','Реал Мадрид — Ман Сити']);
});

test('dates distinguish repeated fixtures, real 0:0 remains visible and future placeholders do not',async({page})=>{
  await setup(page);await category(page,'Матчи').click();await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.search-match-date').first()).toContainText('2026');
  await expect(page.locator('.search-match-score')).toHaveCount(1);await expect(page.locator('.search-match-score')).toHaveText('0:0');
  await page.getByRole('option').first().click();await expect(page).toHaveURL(/\/match\/101/);await expect(page.locator('.md-score')).toHaveCount(2);await expect(page.locator('.md-score').first()).toBeVisible();
});

test('clearing a pending search preserves the category and cancels its late results',async({page})=>{
  await setup(page);await category(page,'Игроки').click();await page.evaluate(()=>window.__categoryHold=true);await page.locator('#globalSearchInput').fill('Real');
  await expect.poll(()=>page.evaluate(()=>typeof window.__releaseCategory)).toBe('function');
  await page.getByRole('button',{name:'Очистить запрос',exact:true}).click();await page.evaluate(()=>window.__releaseCategory());
  await expect(page.getByRole('option')).toHaveCount(0);await expect(page.getByText('Введите название, чтобы искать в этой категории.')).toBeVisible();
  await expect(category(page,'Игроки')).toHaveAttribute('aria-pressed','true');
});

test('missing category reader is an error and never becomes a locally filtered preview',async({page})=>{
  await setup(page);await page.evaluate(()=>window.__categoryFailure='PGRST202');
  await category(page,'Клубы').click();await page.locator('#globalSearchInput').fill('Real');await expect(page.getByText('Поиск временно недоступен')).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(0);await category(page,'Все').click();await expect(page.getByRole('option')).toHaveCount(1);
});

for(const width of [320,390,1440])for(const theme of ['dark','light']){
  test(`categories ${width}px ${theme}: readable RU/EN, accessible controls and match details`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:844});await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
    await setup(page,width===320?'en':'ru');await category(page,width===320?'Matches':'Матчи').click();await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(2);
    const dialog=page.locator('.global-search-box');await page.evaluate(()=>document.fonts.ready);
    await dialog.evaluate(async e=>Promise.all(e.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
    expect(await dialog.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.locator('.search-categories button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44))).toBe(true);
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    expect(await page.evaluate(async()=>(await axe.run(document.querySelector('#searchOv'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([]);
    if(width!==320)await expect(dialog).toHaveScreenshot(`search-category-${width}-${theme}.png`,{animations:'disabled',maxDiffPixelRatio:.02});
    await page.keyboard.press('Escape');await expect(page.locator('#globalSearchBtn')).toBeFocused();
  });
}
