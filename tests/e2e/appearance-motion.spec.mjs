import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

async function checkLayout(page,context='#settingsOv'){
  await page.evaluate(async selector=>{
    await document.fonts.ready;
    await Promise.all(document.querySelector(selector).getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
  },context);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  expect(await page.evaluate(async selector=>{
    const result=await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
    return result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
  },context)).toEqual([]);
}

const accentNames={emerald:'Зеленый',ice:'Голубой',gold:'Золотой',mono:'Серый'};
async function chooseRadio(page,name){
  const radio=page.getByRole('radio',{name,exact:true});
  await radio.locator('..').click();
  await expect(radio).toBeChecked();
}
for(const theme of ['dark','light'])for(const accent of Object.keys(accentNames)){
  test(`гость сохраняет оформление ${theme}/${accent} без аккаунта`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await installSupabaseMock(page,{sessionUser:null});
    await page.setViewportSize({width:390,height:844});
    await page.goto('/?__e2e=1');
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await chooseRadio(page,theme==='light'?'Светлая Высокий контраст':'Темная Меньше света');
    await chooseRadio(page,accentNames[accent]);
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await expect(page.locator('html')).toHaveAttribute('data-accent',accent);
    await expect(page.getByRole('button',{name:'Настройки',exact:true})).toBeFocused();
    await page.reload();
    await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await expect(page.locator(`input[name="setTheme"][value="${theme}"]`)).toBeChecked();
    await expect(page.locator(`input[name="setAccent"][value="${accent}"]`)).toBeChecked();
    await expect(page.getByRole('dialog',{name:'Настройки'})).toContainText('Оформление сохраняется на этом устройстве.');
    await checkLayout(page);
    expect(errors).toEqual([]);
  });
}

for(const width of [320,1440])test(`гостевые настройки доступны с клавиатуры на ${width}px`,async({page})=>{
  await installSupabaseMock(page,{sessionUser:null});
  await page.setViewportSize({width,height:844});
  await page.goto('/?__e2e=1');
  const trigger=page.getByRole('button',{name:'Настройки',exact:true});
  await trigger.focus();await trigger.press('Enter');
  await expect(page.locator('#settingsOv .settings-head .icon-btn')).toBeFocused();
  await checkLayout(page);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('отмена не меняет оформление и следующий вход восстанавливает сохранённый выбор',async({page})=>{
  await installSupabaseMock(page,{sessionUser:null});
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await chooseRadio(page,'Светлая Высокий контраст');
  await chooseRadio(page,'Золотой');
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent','emerald');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Темная Меньше света',exact:true})).toBeChecked();
  await expect(page.getByRole('radio',{name:'Зеленый',exact:true})).toBeChecked();
});

test('системная тема следует изменению устройства, а явная тема остаётся выбранной',async({page})=>{
  await installSupabaseMock(page,{sessionUser:null});
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await chooseRadio(page,'Системная Как на устройстве');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  await chooseRadio(page,'Темная Меньше света');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await page.emulateMedia({colorScheme:'dark'});await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

for(const width of [390,1440])test(`reduced motion сохраняет доступность фильтров, оценки и уведомлений ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await installSupabaseMock(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:1000});
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#matchRatingRange')).toBeVisible();
  await page.locator('#matchRatingRange').press('End');
  await expect(page.locator('#rScoreDisp')).toHaveText('10/10');
  expect(await page.locator('.rate-box').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.locator('.md-primary-action')).toBeFocused();
  await page.goto('/discover?__e2e=1');
  await page.getByRole('button',{name:'Фильтры',exact:true}).click();
  await expect(page.locator('.explore-panel')).toBeVisible();
  expect(await page.locator('.explore-panel').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/^Уведомления/}).click();
  await expect(page.locator('.notif-item')).toHaveCount(2);
  expect(await page.locator('#notifPanel').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await checkLayout(page,'#notifPanel');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:/^Уведомления/})).toBeFocused();
  expect(errors).toEqual([]);
});
