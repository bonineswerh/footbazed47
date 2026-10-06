import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const own='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
const summary={scope:'own',total:65,average:8.5,reviewed:3,minimum:3,maximum:9,tournament_count:8,
  distribution:Array.from({length:10},(_,i)=>({rating:10-i,count:10-i===9?60:10-i===3?5:0})),
  tournaments:Array.from({length:6},(_,i)=>({id:7+i,name:i===0?'Champions League':'Турнир с подробным названием '+i,votes:i===0?9:8,average:9}))};
const empty={scope:'public',total:0,average:null,reviewed:0,minimum:null,maximum:null,tournament_count:0,
  distribution:Array.from({length:10},(_,i)=>({rating:10-i,count:0})),tournaments:[]};

test('профиль использует полную историю, а не маленькую страницу оценок или старый счётчик',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await installSupabaseMock(page,{profileSummaries:{[own]:summary}});
  await page.goto(`/profile/${own}?__e2e=1`);
  await expect(page.locator('.pstats .pst-v').nth(0)).toHaveText('65');
  await expect(page.locator('.pstats .pst-v').nth(1)).toHaveText('8.5');
  await expect(page.getByRole('heading',{name:'65 матчей в дневнике'})).toBeVisible();
  await expect(page.locator('.p-insight-grid')).toContainText('3с комментарием8турниров3–9');
  await expect(page.locator('.profile-tournament')).toHaveCount(6);
  await expect(page.locator('.prdist-note')).toHaveText('65 доступных оценок. Вся ваша история.');
  await expect(page.locator('.prdist-row[data-tone="elite"]').filter({hasText:/^\s*9\b/}).locator('b')).toHaveText('60');
  await expect(page.locator('.profile-sample')).toContainText('включая оценки «Только вам»');
  await page.locator('.profile-tournament').filter({hasText:'Лига чемпионов'}).click();
  await expect(page).toHaveURL(/\/competition\/7\?__e2e=1$/);
  await expect(page.locator('#competitionC .entity-hero h1')).toHaveText('Лига чемпионов');
  expect(errors).toEqual([]);
});

test('публичный профиль не выдаёт глобальный счётчик за доступную историю',async({page})=>{
  await installSupabaseMock(page,{profileSummaries:{[other]:{...summary,scope:'public',total:60,average:9,minimum:9,reviewed:2,
    distribution:summary.distribution.map(x=>({...x,count:x.rating===9?60:0}))}}});
  await page.goto(`/profile/${other}?__e2e=1`);
  await expect(page.locator('.pstats .pst-v').first()).toHaveText('60');
  await expect(page.locator('.pstats .pst-l').first()).toHaveText('Публичных оценок');
  await expect(page.locator('.pstats .pst-v').nth(1)).toHaveText('9.0');
  await expect(page.locator('.profile-sample')).toContainText('всей публичной истории');
  await expect(page.locator('.prdist-note')).toHaveText('60 доступных оценок. Вся публичная история.');
  await expect(page.locator('.pstats .rating-ink')).toHaveAttribute('data-tone','elite');
});

test('нулевая полная история не показывает старую среднюю и не рисует распределение',async({page})=>{
  await installSupabaseMock(page,{profileSummaries:{[other]:empty}});
  await page.goto(`/profile/${other}?__e2e=1`);
  await expect(page.locator('.pstats .pst-v').first()).toHaveText('0');
  await expect(page.locator('.pstats .pst-v').nth(1)).toHaveText('—');
  await expect(page.locator('.prdist-row')).toHaveCount(0);
  await expect(page.getByText('Оценок пока нет',{exact:true})).toBeVisible();
});

test('старый сервер сохраняет обозначенный ограниченный sample fallback',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(`/profile/${own}?__e2e=1`);
  await expect(page.locator('.profile-sample')).toContainText('часть истории');
  await expect(page.locator('.prdist-note')).toContainText('Полная история может быть больше');
  await expect(page.locator('.pstats .pst-v').first()).toHaveText('11');
});

for(const width of [320,390,1440])for(const theme of ['dark','light']){
  test(`полная статистика читаема и доступна: ${width}px ${theme}`,async({page})=>{
    await installSupabaseMock(page,{profileSummaries:{[own]:summary}});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
    await page.setViewportSize({width,height:1000});
    await page.goto(`/profile/${own}?__e2e=1`);
    await expect(page.locator('.profile-tournament')).toHaveCount(6);
    await expect(page.getByRole('button',{name:'Меню аккаунта bazed',exact:true})).toBeVisible();
    expect(await page.locator('#accountBtn').evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.locator('.profile-tournament').first().evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const detail=await page.locator('.prdist-row b').first().evaluate(e=>({font:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight}));
    expect(detail.font).toContain('Onest Variable');expect(Number(detail.weight)).toBeGreaterThanOrEqual(600);
    if(theme==='light')expect(await page.locator('.profile-tournament').first().evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    const failures=await page.evaluate(async()=>{
      const r=await axe.run(document.body,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
      return r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
    });
    expect(failures).toEqual([]);
  });
}

for(const width of [390,1440])for(const theme of ['dark','light']){
  test(`полная статистика сохраняет композицию ${width}px ${theme}`,async({page})=>{
    await installSupabaseMock(page,{profileSummaries:{[own]:summary}});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
    await page.setViewportSize({width,height:1000});
    await page.goto(`/profile/${own}?__e2e=1`);
    await expect(page.locator('.profile-tournament')).toHaveCount(6);
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#profileW')).toHaveScreenshot(`profile-summary-${width}-${theme}.png`,{animations:'disabled',maxDiffPixelRatio:.02});
  });
}
