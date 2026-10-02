import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';


test.beforeEach(async({page})=>{
  await installSupabaseMock(page);
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,route=>route.abort());
  page.__socialErrors=[];
  page.on('pageerror',error=>page.__socialErrors.push(error.message));
});

test.afterEach(async({page})=>{
  expect(page.__socialErrors).toEqual([]);
});

test('поиск исправляет только известные повреждённые служебные подписи старого RPC',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='search_footbazed_v2'?Promise.resolve({data:[
      {entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'РљР»СѓР±'},
      {entity_type:'match',entity_id:'101',title:'Real Madrid вЂ” Man City',subtitle:'Champions League',meta:'finished'},
      {entity_type:'club',entity_id:'25',title:'Динамо',subtitle:'Россия',meta:'DIN'}
    ],error:null}):original(name,args);
  });
  await page.locator('#globalSearchInput').fill('real');
  await expect(page.getByRole('option').first()).toHaveText('Real Madrid CFКлуб→');
  await expect(page.getByRole('option').nth(1)).toContainText('Real Madrid — Man City');
  await expect(page.getByRole('option').nth(2)).toContainText('ДинамоРоссия');
});

test('новый поисковый запрос сразу отменяет выбор прежнего результата с клавиатуры',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='search_footbazed_v2'
      ?args.p_query==='Первый'
        ?Promise.resolve({data:[{entity_type:'club',entity_id:'24',title:'Первый клуб'}],error:null})
        :new Promise(resolve=>{window.__resolveSocialSearch=resolve;})
      :original(name,args);
  });
  const input=page.getByRole('combobox');
  await input.fill('Первый');
  await expect(page.getByRole('option',{name:/Первый клуб/})).toBeVisible();
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant','global-search-option-0');
  await input.fill('Второй');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('#searchOv')).toBeVisible();
  await expect(page).not.toHaveURL(/\/club\/24/u);
  await expect(input).not.toHaveAttribute('aria-activedescendant',/\S/u);
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveSocialSearch)).toBe('function');
  await page.evaluate(()=>window.__resolveSocialSearch({data:[{entity_type:'player',entity_id:'5290',title:'Thibaut Courtois'}],error:null}));
  await expect(page.getByRole('option',{name:/Thibaut Courtois/})).toBeVisible();
  await input.press('ArrowDown');await input.press('Enter');
  await expect(page).toHaveURL(/\/player\/5290\?__e2e=1$/u);
  await expect(page).toHaveTitle(/Thibaut Courtois/u);
});

test('ответ старого поиска во время debounce не заменяет новый запрос',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    window.__socialSearchResolvers={};
    sb.rpc=(name,args)=>name==='search_footbazed_v2'?new Promise(resolve=>{window.__socialSearchResolvers[args.p_query]=resolve;}):original(name,args);
  });
  await page.locator('#globalSearchInput').fill('Старый');
  await expect.poll(()=>page.evaluate(()=>typeof window.__socialSearchResolvers['Старый'])).toBe('function');
  await page.evaluate(()=>{
    const input=document.getElementById('globalSearchInput');
    input.value='Новый';input.dispatchEvent(new Event('input',{bubbles:true}));
    window.__socialSearchResolvers['Старый']({data:[{entity_type:'club',entity_id:'24',title:'Устаревший результат'}],error:null});
  });
  await expect(page.getByRole('option',{name:/Устаревший результат/})).toHaveCount(0);
  await expect(page.locator('#globalSearchResults')).toHaveAttribute('aria-busy','true');
  await expect.poll(()=>page.evaluate(()=>typeof window.__socialSearchResolvers['Новый'])).toBe('function');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__socialSearchResolvers['Новый']({data:[{entity_type:'club',entity_id:'24',title:'Поздний результат'}],error:null}));
  await page.keyboard.press('Control+k');
  await expect(page.locator('#globalSearchInput')).toHaveValue('');
  await expect(page.getByRole('option',{name:/Поздний результат/})).toHaveCount(0);
});

test('пустая следующая страница ленты сохраняет прочитанные оценки',async({page})=>{
  await page.goto('/feed?__e2e=1');
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await page.evaluate(async()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=async(name,args)=>{
      if(name!=='get_social_feed_page'||args.p_limit!==12)return original(name,args);
      if(args.p_cursor_rating_id)return{data:{items:[],has_more:false,next_cursor:null},error:null};
      const result=await original(name,args);
      return{...result,data:{...result.data,has_more:true,next_cursor:{created_at:'2026-08-09T11:00:00Z',rating_id:502,score:0}}};
    };
    await FBZFeed.load();
  });
  await page.getByRole('button',{name:'Показать ещё',exact:true}).click();
  await expect(page.locator('#feedMore')).toBeEmpty();
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await expect(page.locator('.feed-empty')).toHaveCount(0);
  await expect(page.locator('#feedMeta')).toContainText('2');
});

test('закрытие обсуждения не позволяет поздней ошибке открыть его снова',async({page})=>{
  await page.goto('/feed?__e2e=1');
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='get_rating_comments'?new Promise(resolve=>{window.__resolveSocialComments=resolve;}):original(name,args);
  });
  const toggle=page.locator('[data-rating-id="501"]').getByRole('button',{name:'Обсудить оценку'});
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
  await page.evaluate(()=>window.__resolveSocialComments({data:null,error:{message:'offline'}}));
  await expect(page.locator('#feed-comments-501')).toBeEmpty();
});
