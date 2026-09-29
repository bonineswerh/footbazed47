import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{
  await installSupabaseMock(page);
  await page.addInitScript(()=>{
    window.cspViolations=[];
    document.addEventListener('securitypolicyviolation',event=>window.cspViolations.push({directive:event.effectiveDirective,source:event.blockedURI}));
  });
});

test('real response policy blocks injected scripts, event attributes and executable strings',async({page})=>{
  const response=await page.goto('/?__e2e=1');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'; script-src-attr 'none'");
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  await page.route('**/csp-eval-probe.js',route=>route.fulfill({contentType:'application/javascript',body:`
    try { new Function('window.cspExecuted = true')(); } catch { window.cspEvalBlocked = true; }
  `}));
  await page.evaluate(()=>{
    const script=document.createElement('script');
    script.textContent='window.cspExecuted = true';document.body.append(script);
    const button=document.createElement('button');
    button.setAttribute('onclick','window.cspExecuted = true');document.body.append(button);button.click();button.remove();
    const external=document.createElement('script');
    external.src='https://not-allowed.invalid/probe.js';document.body.append(external);
  });
  await page.addScriptTag({url:'/csp-eval-probe.js'});
  await expect.poll(()=>page.evaluate(()=>window.cspEvalBlocked)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.cspViolations.length)).toBeGreaterThanOrEqual(4);
  expect(await page.evaluate(()=>Boolean(window.cspExecuted))).toBe(false);
  const violations=await page.evaluate(()=>window.cspViolations);
  expect(violations.some(v=>v.directive==='script-src-attr')).toBe(true);
  expect(violations.some(v=>v.source==='eval')).toBe(true);
  expect(violations.some(v=>v.source.startsWith('https://not-allowed.invalid'))).toBe(true);
});

test('a saved search containing quotes and HTML remains inert data when clicked',async({page})=>{
  const query=`Клуб' ");window.cspExecuted=true;// <img src=x onerror=alert(1)> &`;
  await page.addInitScript(query=>localStorage.setItem('fbz:recent-searches',JSON.stringify([query])),query);
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  const recent=page.locator('.search-recent button');
  await expect(recent).toHaveText(query);
  await recent.click();
  await expect(page.locator('#globalSearchInput')).toHaveValue(query);
  expect(await page.locator('.search-recent img').count()).toBe(0);
  expect(await page.evaluate(()=>Boolean(window.cspExecuted))).toBe(false);
  expect(await page.evaluate(()=>window.cspViolations)).toEqual([]);
});

test('entity tabs, form submission and account navigation run without policy violations',async({page})=>{
  const errors=[];page.on('console',message=>{if(message.text()==='UI action failed')errors.push(message.text());});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/club/24?__e2e=1');
  await page.getByRole('tab',{name:/Состав/}).click();
  await page.getByRole('tab',{name:/Состав/}).press('ArrowRight');
  await expect(page.getByRole('tab',{name:/Матчи/})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'Лента',exact:true}).click();
  await page.locator('.feed-action[aria-label="Обсудить оценку"]').first().click();
  const form=page.locator('.comment-form').first();
  await form.locator('input').fill('Проверка формы под CSP');
  await form.getByRole('button',{name:'Отправить',exact:true}).click();
  await expect(page.getByText('Проверка формы под CSP',{exact:true})).toBeVisible();
  await page.locator('#accountBtn').click();
  await page.getByRole('menuitem',{name:/Мой профиль/}).click();
  await expect(page.locator('#profileW')).toContainText('bazed');
  expect(await page.evaluate(()=>Array.from(document.querySelectorAll('*')).flatMap(el=>Array.from(el.attributes).filter(attr=>/^on[a-z]+$/i.test(attr.name))).length)).toBe(0);
  expect(await page.evaluate(()=>window.cspViolations)).toEqual([]);
  expect(errors).toEqual([]);
});

test('legacy admin link redirects with the same strict script policy',async({page})=>{
  await page.route('**/api/admin*',route=>route.fulfill({json:{counts:{},recentMatches:[],footballApiConfigured:true}}));
  await page.goto('/admin.html?__e2e=1');
  await expect(page).toHaveURL(/\/admin$/);
  expect(await page.evaluate(()=>window.cspViolations)).toEqual([]);
});
