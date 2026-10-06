import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const results=[
  {entity_type:'player',entity_id:'5290',title:'Thibaut Courtois',subtitle:'Real Madrid',meta:'GK'},
  {entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'Spain',meta:'RMA'},
  {entity_type:'player',entity_id:'5291',title:'Jude Bellingham',subtitle:'Real Madrid',meta:'CM'},
  {entity_type:'club',entity_id:'25',title:'FC Barcelona',subtitle:'Spain',meta:'BAR'}
];
async function prepare(page){
  await installSupabaseMock(page);
  await page.addInitScript(results=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__discoverySearchCalls=[];
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name!=='search_footbazed_v2')return rpc(name,args);
      window.__discoverySearchCalls.push(args);
      if(args.p_query==='Отложенный')return new Promise(resolve=>{window.__resolveDiscoverySearch=resolve;});
      return Promise.resolve({data:results,error:null});
    };
  },results);
}

test('grouped search keyboard follows displayed order and preserves one bounded data request',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page);
  await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  const input=page.locator('#globalSearchInput');await input.fill('Real');
  await expect(page.locator('.search-result-copy strong')).toHaveText(['Thibaut Courtois','Jude Bellingham','Реал Мадрид','Барселона']);
  await expect(page.locator('.search-result-group')).toHaveCount(2);
  await expect(page.locator('.search-result-group').first()).toHaveAttribute('aria-labelledby','search-group-player');
  await expect(page.locator('#globalSearchStatus')).toHaveText('4 совпадения в подборке');
  await input.press('ArrowDown');await input.press('ArrowDown');await input.press('ArrowDown');
  await expect(page.getByRole('option').nth(2)).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>window.__discoverySearchCalls)).toEqual([{p_query:'Real',p_limit:14}]);
  await input.press('Enter');await expect(page).toHaveURL(/\/club\/24/);
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');expect(errors).toEqual([]);
});

test('clear cancels a pending response, restores the input and keeps recent queries usable',async({page})=>{
  await prepare(page);await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  const input=page.locator('#globalSearchInput');await input.fill('Отложенный');
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveDiscoverySearch)).toBe('function');
  await page.getByRole('button',{name:'Очистить запрос',exact:true}).click();
  await expect(input).toHaveValue('');await expect(input).toBeFocused();
  await expect(page.locator('#globalSearchResults')).toHaveAttribute('aria-busy','false');
  await expect(page.getByRole('button',{name:'Очистить запрос',exact:true})).toBeHidden();
  await page.evaluate(async()=>{window.__resolveDiscoverySearch({data:[{entity_type:'club',entity_id:'24',title:'Устаревший результат'}],error:null});await Promise.resolve();await Promise.resolve();});
  await expect(page.getByRole('option',{name:/Устаревший результат/})).toHaveCount(0);
  await input.fill('Real');await expect(page.getByRole('option')).toHaveCount(4);await input.press('ArrowDown');await input.press('Enter');
  await expect(page).toHaveURL(/\/player\/5290/);
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.getByRole('button',{name:'Real',exact:true}).click();
  await expect(input).toHaveValue('Real');await expect(page.getByRole('button',{name:'Очистить запрос',exact:true})).toBeVisible();
  await expect(page.getByRole('option')).toHaveCount(4);
});

for(const theme of ['dark','light'])for(const accent of ['emerald','ice','gold','mono']){
  test(`search and overview geometry ${theme} ${accent}`,async({page})=>{
    await prepare(page);await page.setViewportSize({width:accent==='ice'?1440:320,height:accent==='ice'?1000:700});
    await page.addInitScript(appearance=>localStorage.setItem('fbz_appearance',JSON.stringify(appearance)),{theme,accent});
    await page.goto('/discover?__e2e=1');await expect(page.locator('.statistics-row')).toBeVisible();
    const score=page.locator('.statistics-score').first();await expect(score).toHaveAttribute('aria-label',/Средняя оценка болельщиков/);
    const scoreBox=await score.boundingBox(),contentBox=await page.locator('.statistics-content').first().boundingBox();
    expect(contentBox.x+contentBox.width).toBeLessThanOrEqual(scoreBox.x);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Поиск',exact:true}).click();await page.locator('#globalSearchInput').fill('Real');
    await expect(page.getByRole('option')).toHaveCount(4);await expect(page.getByRole('button',{name:'Закрыть поиск',exact:true})).toBeInViewport();
    const clearBox=await page.getByRole('button',{name:'Очистить запрос',exact:true}).boundingBox();
    expect(clearBox.width).toBeGreaterThanOrEqual(44);expect(clearBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.querySelector('.global-search-box').scrollWidth<=document.querySelector('.global-search-box').clientWidth)).toBe(true);
    await page.keyboard.press('Escape');await expect(page.locator('#globalSearchBtn')).toBeFocused();
  });
}

test('account menu contains settings and session actions without duplicate navigation',async({page})=>{
  await installSupabaseMock(page);await page.goto('/?__e2e=1');await page.locator('#accountBtn').click();
  await expect(page.getByRole('menuitem',{name:/Мой профиль|Друзья/})).toHaveCount(0);
  await page.getByRole('menuitem',{name:/Настройки/}).focus();await page.keyboard.press('End');
  await expect(page.getByRole('menuitem',{name:'Выйти',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await expect(page.getByRole('menuitem',{name:/Админ-панель/})).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.locator('#accountBtn')).toBeFocused();
  await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Профиль',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Открыть друзей:'}).click();
  await expect(page).toHaveURL(/\/friends/);await expect(page.getByRole('heading',{name:'Друзья и сообщество'})).toBeVisible();
});

test('grouped search remains accessible in both themes',async({page})=>{
  await prepare(page);await page.setViewportSize({width:390,height:844});await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(4);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  for(const theme of ['dark','light']){
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.querySelector('#searchOv').getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    const violations=await page.evaluate(async()=>{const result=await window.axe.run(document.querySelector('#searchOv'));return result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
    expect(violations,theme).toEqual([]);
  }
});

test('search stays scrollable with enlarged text and in a short landscape viewport',async({page})=>{
  await prepare(page);await page.setViewportSize({width:390,height:844});await page.goto('/?__e2e=1');
  await page.addStyleTag({content:':root{font-size:200%}'});
  await page.getByRole('button',{name:'Поиск',exact:true}).click();await page.locator('#globalSearchInput').fill('Real');
  await expect(page.getByRole('option')).toHaveCount(4);
  await expect(page.getByRole('button',{name:'Закрыть поиск',exact:true})).toBeInViewport();
  expect(await page.locator('.global-search-box').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.getByRole('option').last().scrollIntoViewIfNeeded();await expect(page.getByRole('option').last()).toBeInViewport();
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByRole('button',{name:'Закрыть поиск',exact:true})).toBeInViewport();
  await page.getByRole('option').last().scrollIntoViewIfNeeded();await expect(page.getByRole('option').last()).toBeInViewport();
  expect(await page.locator('.global-search-box').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;})).toBe(true);
});
