import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{await installSupabaseMock(page);});

for(const theme of ['dark','light'])test(`${theme}: navigation, filters, ratings and keyboard in each browser`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row').first()).toBeVisible();
  await page.getByRole('button',{name:'Игроки',exact:true}).click();
  await expect(page.locator('#statisticsList')).toContainText('Jude Bellingham');
  await page.getByRole('searchbox',{name:'Поиск в обзоре'}).fill('Courtois');
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.locator('.statistics-row').press('Enter');
  await expect(page.locator('.player-hero h1')).toHaveText('Thibaut Courtois');
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();
  await page.getByRole('button',{name:/Продолжить/}).click();
  await page.locator('#rating-player-5292').click();
  await page.locator('#playerRatingRange').press('End');
  await expect(page.locator('#playerRatingValue')).toHaveText('10/10');
  await expect(page.locator('#playerRatingValue')).toHaveAttribute('data-tone','elite');
  await page.keyboard.press('Escape');
  await expect(page.locator('#rateOv')).not.toHaveClass(/on/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  expect(errors).toEqual([]);
});

for(const viewport of [{width:667,height:375},{width:844,height:390},{width:820,height:1180},{width:1180,height:820},{width:1366,height:768},{width:1920,height:1080},{width:2560,height:1440},{width:3440,height:1440},{width:3840,height:2160}]){
  test(`layout and modal ${viewport.width}×${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.goto('/match/101?__e2e=1');
    await expect(page.locator('.md-hero')).toBeVisible();
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,hero:document.querySelector('.md-hero').getBoundingClientRect().width}));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.hero).toBeLessThanOrEqual(1600);
    await page.locator('.md-primary-action').click();
    await page.getByRole('button',{name:/Продолжить/}).click();
    await page.locator('#rating-player-5292').click();
    await page.locator('#playerRatingRange').press('End');
    await expect(page.locator('#playerRatingValue')).toHaveText('10/10');
    const modal=await page.locator('.rate-box').boundingBox();
    expect(modal.y).toBeGreaterThanOrEqual(-1);
    expect(modal.y+modal.height).toBeLessThanOrEqual(viewport.height+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  });
}

test('text at 200 percent preserves controls and content',async({page})=>{
  await page.setViewportSize({width:820,height:1180});
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row').first()).toBeVisible();
  await page.addStyleTag({content:'html{font-size:200%!important}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  await page.getByRole('button',{name:'Игроки',exact:true}).click();
  await expect(page.locator('#statisticsList')).toContainText('Jude Bellingham');
});
