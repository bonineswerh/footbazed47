import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const logo={id:1,asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url:'https://media.api-sports.io/football/teams/529.png'};
const photo={id:2,asset_type:'player_photo',usage_status:'verified',source_provider:'test',url:'https://assets.example.test/player.png'};
const results=[
  {entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'Spain',meta:'RMA',relevance:1,visual:{id:'24',name:'Real Madrid CF',tla:'RMA',primary_color:'#E7ECEF',secondary_color:'#274C77',media:logo}},
  {entity_type:'player',entity_id:'5290',title:'Thibaut Courtois',subtitle:'Real Madrid',meta:'GK',relevance:.9,visual:{id:'5290',name:'Thibaut Courtois',media:photo}},
  {entity_type:'competition',entity_id:'7',title:'Champions League',subtitle:'Europe',meta:'CL',relevance:.8,visual:{id:'7',name:'Champions League',media:null}}
];

async function setup(page){
  await installSupabaseMock(page);
  await page.addInitScript(results=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__searchCalls=[];
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name==='search_footbazed_v2'){window.__searchCalls.push({name,args});return Promise.resolve({data:results,error:null});}
      return rpc(name,args);
    };
  },results);
  await page.route('https://media.api-sports.io/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path fill="#d7b464" d="M5 4h26v22L18 34 5 26z"/></svg>'}));
  await page.route('https://assets.example.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><circle fill="#8eaebe" cx="18" cy="18" r="16"/></svg>'}));
}
async function openSearch(page){
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.locator('#globalSearchInput').fill('Real');
  await expect(page.getByRole('option')).toHaveCount(3);
}

test('поиск остаётся ленивым, получает media одним запросом и сохраняет клавиатурный переход',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.FBZSearch))).toBe(false);
  await expect(page.locator('#searchStyles')).toHaveCount(0);
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.locator('#globalSearchInput').fill('Real');
  await expect(page.getByRole('option')).toHaveCount(3);
  await expect(page.locator('.search-mark.has-image')).toHaveCount(2);
  await expect.poll(()=>page.locator('.search-mark img').evaluateAll(imgs=>imgs.length===2&&imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  expect(await page.evaluate(()=>window.__searchCalls)).toEqual([{name:'search_footbazed_v2',args:{p_query:'Real',p_limit:14}}]);
  await page.locator('#globalSearchInput').press('ArrowDown');await page.locator('#globalSearchInput').press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected','true');
  await page.locator('#globalSearchInput').press('Enter');
  await expect(page).toHaveURL(/\/player\/5290\?__e2e=1$/);
  await expect(page.locator('.player-hero h1')).toHaveText('Thibaut Courtois');expect(errors).toEqual([]);
});

test('недоступное изображение заменяется монограммой и не скрывает результат',async({page})=>{
  await setup(page);await page.route('https://media.api-sports.io/**',route=>route.abort());
  await openSearch(page);
  const row=page.getByRole('option').first();await expect(row.locator('img')).toHaveCount(0);
  await expect(row.locator('.search-mark.is-fallback')).toContainText('RMA');
  await row.click();await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
});

test('unknown и неправильный тип media не превращаются в фото',async({page})=>{
  await setup(page);
  await page.addInitScript(results=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>name==='search_footbazed_v2'?Promise.resolve({data:[
      {...results[1],visual:{...results[1].visual,media:{...results[1].visual.media,usage_status:'unknown'}}},
      {...results[0],visual:{...results[0].visual,media:results[1].visual.media}}
    ],error:null}):rpc(name,args);
  },results);
  await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(2);
  await expect(page.locator('.search-mark img')).toHaveCount(0);await expect(page.locator('.search-mark.is-fallback')).toHaveCount(2);
});

test('только отсутствие v2 даёт legacy fallback; ошибка сети требует явного повтора',async({page})=>{
  await setup(page);
  await page.addInitScript(()=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__legacyCalls=0;window.__searchFailure='PGRST202';
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name==='search_footbazed_v2')return Promise.resolve({data:null,error:{code:window.__searchFailure}});
      if(name==='search_footbazed')window.__legacyCalls++;
      return rpc(name,args);
    };
  });
  await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.locator('#globalSearchInput').fill('Real');await expect(page.getByRole('option')).toHaveCount(1);
  expect(await page.evaluate(()=>window.__legacyCalls)).toBe(1);
  await page.evaluate(()=>window.__searchFailure='NETWORK');
  await page.locator('#globalSearchInput').fill('Madrid');await expect(page.getByText('Поиск временно недоступен')).toBeVisible();
  expect(await page.evaluate(()=>window.__legacyCalls)).toBe(1);
  await page.evaluate(()=>window.__searchFailure='PGRST202');await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('option')).toHaveCount(1);expect(await page.evaluate(()=>window.__legacyCalls)).toBe(2);
});

test('ошибка lazy CSS допускает повтор без второго скрипта',async({page})=>{
  await setup(page);let attempts=0,scripts=0;
  page.on('request',request=>{if(request.url().includes('/js/search.js'))scripts++;});
  await page.route('**/css/search.css*',route=>++attempts===1?route.abort():route.continue());
  await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.getByText('Не удалось загрузить раздел',{exact:true})).toBeVisible();
  await expect(page.locator('#searchOv')).not.toHaveClass(/on/);
  await page.getByRole('button',{name:'Поиск',exact:true}).click();await expect(page.locator('#globalSearchInput')).toBeVisible();
  expect(attempts).toBe(2);expect(scripts).toBe(1);
});

test('поздняя загрузка поиска не открывает его на новой странице',async({page})=>{
  await setup(page);let release;const hold=new Promise(resolve=>{release=resolve;});
  await page.route('**/js/search.js*',async route=>{await hold;await route.continue();});
  await page.goto('/?__e2e=1');await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await page.getByRole('button',{name:'Матчи',exact:true}).first().click();release();
  await expect(page.locator('#matchG .mcard').first()).toBeVisible();
  await expect(page.locator('#searchOv')).not.toHaveClass(/on/);
  await page.getByRole('button',{name:'Поиск',exact:true}).click();await expect(page.locator('#globalSearchInput')).toBeVisible();
});

for(const width of [320,390,1440])for(const theme of ['dark','light']){
  test(`поиск с media: ${width}px ${theme}, доступность и чёткие детали`,async({page},testInfo)=>{
    await setup(page);await page.setViewportSize({width,height:844});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
    await openSearch(page);await page.evaluate(()=>document.fonts.ready);
    const dialog=page.locator('.global-search-box');
    await dialog.evaluate(async element=>{await Promise.all(element.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
    expect(await dialog.evaluate(e=>e.scrollWidth-e.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.locator('.global-search-close').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    const violations=await page.evaluate(async()=>{
      const r=await axe.run(document.querySelector('#searchOv'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
      return r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
    });expect(violations).toEqual([]);
    await dialog.screenshot({path:testInfo.outputPath('search-media.png')});
    if(width!==320)await expect(dialog).toHaveScreenshot(`search-media-${width}-${theme}.png`,{animations:'disabled',maxDiffPixelRatio:.02});
    await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Поиск',exact:true})).toBeFocused();
  });
}
