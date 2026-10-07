import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const owner='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
async function setup(page,options={}){
  await installSupabaseMock(page,options.fixture||{});
  await page.addInitScript(options=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__blockCalls=[];let lists=0;
    window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{
      if(name==='get_my_user_blocks'){
        lists++;if(options.listErrorOnce&&lists===1)return Promise.resolve({data:null,error:{message:'private SQL details'}});
        if(options.listDelay)return new Promise(resolve=>{window.__resolveBlocks=()=>resolve(rpc(name,args));});
      }
      if(name==='set_user_block'){
        window.__blockCalls.push(structuredClone(args));
        if(options.errorOnce&&window.__blockCalls.length===1)return Promise.resolve({data:null,error:{message:options.errorOnce}});
        if(options.delay)return new Promise(resolve=>{window.__resolveBlock=()=>resolve(rpc(name,args));});
      }
      return rpc(name,args);
    };
  },options);
}
async function ownList(page){await page.goto('/profile/'+owner+'?__e2e=1');await page.getByRole('button',{name:'Заблокированные',exact:true}).click();await expect(page.getByRole('dialog',{name:'Заблокированные',exact:true})).toBeVisible();}
async function confirmation(page){await page.goto('/profile/'+other+'?__e2e=1');await page.getByRole('button',{name:'Действия с пользователем',exact:true}).click();await page.getByRole('button',{name:'Заблокировать',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();}

test('block feature loads only on explicit click; Escape returns focus without a mutation',async({page})=>{
  await setup(page);await page.goto('/profile/'+other+'?__e2e=1');const trigger=page.getByRole('button',{name:'Действия с пользователем',exact:true});await expect(trigger).toBeVisible();
  expect(await page.evaluate(()=>Boolean(window.FBZCommunityBlocks))).toBe(false);await expect(page.locator('#communityBlockStyles')).toHaveCount(0);
  await trigger.click();await page.getByRole('button',{name:'Заблокировать',exact:true}).click();await expect(page.getByRole('alertdialog')).toContainText('История оценок сохраняется');await expect(page.locator('#confirmAction')).toBeFocused();
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused();expect(await page.evaluate(()=>window.__blockCalls)).toEqual([]);
});
test('successful block invalidates cached profile, feed and notifications while preserving identity',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await confirmation(page);await page.locator('#confirmAction').click();
  await expect(page).toHaveURL(/\/\?(?:.*__e2e=1)?$/);await expect(page.getByRole('button',{name:'Меню аккаунта bazed'})).toBeVisible();
  expect(await page.evaluate(()=>window.__blockCalls)).toEqual([{p_user_id:other,p_blocked:true}]);
  await page.getByRole('button',{name:'Лента',exact:true}).first().click();await expect(page.locator('#feedG')).not.toContainText('Gamlet');
  await page.getByRole('button',{name:/^Уведомления/}).click();await expect(page.locator('#notifList')).not.toContainText('Gamlet');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Друзья',exact:true}).first().click();await page.getByLabel('Найти пользователей').fill('gamlet');await expect(page.locator('#friendSearchRes')).toContainText('Ничего не найдено');
  await page.evaluate(id=>go('profile',{uid:id}),other);await expect(page.locator('#profileW')).toContainText('Профиль недоступен');expect(errors).toEqual([]);
});
test('block errors stay safe, preserve confirmation and allow retry',async({page})=>{
  await setup(page,{errorOnce:'private SQL details'});await confirmation(page);await page.locator('#confirmAction').click();
  await expect(page.locator('#confirmAction')).toBeEnabled();await expect(page.getByRole('alertdialog')).toBeVisible();await expect(page.locator('#toast')).not.toContainText('private SQL');
  await page.locator('#confirmAction').click();await expect(page.getByRole('alertdialog')).not.toBeVisible();expect(await page.evaluate(()=>window.__blockCalls.length)).toBe(2);
});
test('repeated clicks cannot submit duplicate blocking commands',async({page})=>{
  await setup(page,{delay:true});await confirmation(page);await page.locator('#confirmAction').click();await expect(page.locator('#confirmAction')).toBeDisabled();
  await page.evaluate(()=>FBZConfirm.run());expect(await page.evaluate(()=>window.__blockCalls.length)).toBe(1);await page.evaluate(()=>window.__resolveBlock());await expect(page.getByRole('alertdialog')).not.toBeVisible();
});
test('late block response after logout cannot restore an account or hidden UI',async({page})=>{
  await setup(page,{delay:true});await confirmation(page);await page.locator('#confirmAction').click();await page.evaluate(()=>onLogout());await page.evaluate(()=>window.__resolveBlock());
  await expect(page.getByRole('button',{name:'Войти',exact:true}).first()).toBeVisible();await expect(page.getByRole('alertdialog')).not.toBeVisible();await expect(page.locator('#profileW')).toBeEmpty();
});
test('completed mutation after a route change still cancels stale visibility caches',async({page})=>{
  await setup(page,{delay:true});await confirmation(page);await page.locator('#confirmAction').click();await page.evaluate(()=>go('feed'));await expect(page.locator('#feedG')).toContainText('Gamlet');
  await page.evaluate(()=>window.__resolveBlock());await expect(page.locator('#page-home')).toHaveClass(/on/);await page.getByRole('button',{name:'Лента',exact:true}).first().click();await expect(page.locator('#feedG')).not.toContainText('Gamlet');
});
test('own block list has a clear empty state and accessible close focus',async({page})=>{
  await setup(page);await ownList(page);await expect(page.getByRole('dialog',{name:'Заблокированные',exact:true})).toContainText('Блокировок нет');await expect(page.getByRole('button',{name:'Закрыть блокировки'})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Заблокированные',exact:true})).toBeFocused();
});
test('block list shows ten records at a time, escapes labels and returns to previous page',async({page})=>{
  const userBlocks=Array.from({length:12},(_,i)=>({owner_id:owner,user_id:'56000000-0000-0000-0000-'+String(i).padStart(12,'0'),username:'person'+i,display_name:i===0?'<img onerror="alert(1)">':'Person '+i,created_at:'2026-10-03T01:00:00Z'}));
  await setup(page,{fixture:{userBlocks}});await ownList(page);await expect(page.locator('.block-list>li')).toHaveCount(10);await expect(page.locator('.block-list')).toContainText('<img onerror="alert(1)">');await expect(page.locator('.block-list img')).toHaveCount(0);
  const dialog=page.getByRole('dialog',{name:'Заблокированные',exact:true});await dialog.getByRole('button',{name:'Далее →',exact:true}).click();await expect(page.locator('.block-list>li')).toHaveCount(2);await expect(dialog.getByRole('button',{name:'Далее →',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Назад',exact:true}).click();await expect(page.locator('.block-list>li')).toHaveCount(10);
});
test('list error is localized and retry recovers',async({page})=>{
  await setup(page,{listErrorOnce:true});await ownList(page);await expect(page.locator('#blockList')).toContainText('Не удалось загрузить блокировки');await expect(page.locator('#blockList')).not.toContainText('private SQL');await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.locator('#blockList')).toContainText('Блокировок нет');
});
test('unblock preserves historical record and restores access after invalidating cache',async({page})=>{
  await setup(page,{fixture:{userBlocks:[{owner_id:owner,user_id:other,username:'gamlet',display_name:'Gamlet',created_at:'2026-10-03T01:00:00Z'}]}});await ownList(page);await page.getByRole('button',{name:'Снять блокировку с Gamlet'}).click();await expect(page.locator('#page-home')).toHaveClass(/on/);
  expect(await page.evaluate(()=>window.__blockCalls)).toEqual([{p_user_id:other,p_blocked:false}]);await page.evaluate(id=>go('profile',{uid:id}),other);await expect(page.getByRole('heading',{name:'Gamlet',exact:true})).toBeVisible();
});
test('late block-list response is discarded after route change',async({page})=>{
  await setup(page,{listDelay:true});await ownList(page);await page.evaluate(()=>go('matches'));await page.evaluate(()=>window.__resolveBlocks());await expect(page.locator('#blockOverlay')).not.toHaveClass(/on/);await expect(page.locator('#blockList')).toBeEmpty();
});
for(const width of [390,1440])for(const theme of ['dark','light'])test(`block manager stays readable and accessible at ${width} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await setup(page,{fixture:{userBlocks:[{owner_id:owner,user_id:other,username:'gamlet',display_name:'Gamlet',created_at:'2026-10-03T01:00:00Z'}]}});await ownList(page);await page.evaluate(theme=>FBZAppearance.apply({theme,accent:'emerald'}),theme);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.querySelector('.block-panel').getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const close=await page.getByRole('button',{name:'Закрыть блокировки'}).boundingBox();expect(close.width).toBeGreaterThanOrEqual(44);expect(close.height).toBeGreaterThanOrEqual(44);
  const panel=await page.locator('.block-panel').boundingBox();expect(panel.y).toBeGreaterThanOrEqual(0);expect(panel.y+panel.height).toBeLessThanOrEqual(901);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=>(await axe.run(document.querySelector('.block-panel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id))).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('block-manager.png')});
});
