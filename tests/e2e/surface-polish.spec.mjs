import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const own='3615141a-7700-46b8-9ba5-e4f4450537fc';

test('calendar surface opens the match and the rating button remains independent',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page);
  await page.goto('/matches?__e2e=1');
  let card=page.locator('#matchG .mcard').filter({hasText:'Ман Сити'}).first();
  await expect(card).toBeVisible();
  const link=card.getByRole('link',{name:/Открыть матч:/});
  await expect(link).toHaveAttribute('href','/match/101');
  const idleBorder=await card.evaluate(element=>getComputedStyle(element).borderTopColor);
  await card.hover();
  await expect.poll(()=>card.evaluate(element=>getComputedStyle(element).borderTopColor)).not.toBe(idleBorder);
  // The header is outside the visible score link, but inside its card surface.
  await card.click({position:{x:24,y:24}});
  await expect(page).toHaveURL(/\/match\/101/);
  await expect(page.locator('.md-hero')).toContainText('Реал Мадрид');
  await page.goto('/matches?__e2e=1');
  card=page.locator('#matchG .mcard').filter({hasText:'Ман Сити'}).first();
  await card.getByRole('button',{name:'Оценить',exact:true}).click();
  await expect(page.locator('#rateOv')).toBeVisible();
  await expect(page).toHaveURL(/\/matches/);
  await page.keyboard.press('Escape');
  await expect(card.getByRole('button',{name:'Оценить',exact:true})).toBeFocused();
  await card.getByRole('link',{name:/Открыть матч:/}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/match\/101/);
  expect(errors).toEqual([]);
});

test('featured match surface opens the match without swallowing its rating action',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1');
  const feature=page.locator('.home-spotlight');
  await expect(feature).toBeVisible();
  await feature.click({position:{x:24,y:90}});
  await expect(page).toHaveURL(/\/match\/101/);
  await page.goto('/?__e2e=1');
  await feature.getByRole('button',{name:'Оценить матч',exact:true}).click();
  await expect(page.locator('#rateOv')).toBeVisible();
  await expect(page).not.toHaveURL(/\/match\//);
});

test('feed match surface routes to match, club and discussion separately',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page);
  await page.goto('/feed?__e2e=1');
  const post=page.locator('.feed-entry').first();
  await expect(post).toBeVisible();
  const href=await post.locator('.feed-score').getAttribute('href');
  await post.locator('.feed-match').click({position:{x:24,y:24}});
  await expect(page).toHaveURL(new RegExp(href+'(?:\\?|$)'));
  await page.goto('/feed?__e2e=1');
  await post.locator('.feed-team.home').click();
  await expect(page).toHaveURL(/\/club\/\d+/);
  await page.goto('/feed?__e2e=1');
  await post.getByRole('button',{name:'Обсудить оценку',exact:true}).click();
  await expect(post.locator('.comment-form input')).toBeVisible();
  await expect(page).toHaveURL(/\/feed/);
  expect(errors).toEqual([]);
});

test('match link preserves native modified click and English deep link',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/en/matches?__e2e=1');
  const link=page.locator('#matchG .mc-score-link').first();
  await expect(link).toHaveAttribute('href',/^\/en\/match\/\d+$/);
  const destination=await link.getAttribute('href');
  const popupPromise=page.context().waitForEvent('page',{timeout:5000});
  await link.click({modifiers:['Control']});
  const popup=await popupPromise;
  await expect(popup).toHaveURL(new RegExp(destination+'$'));
  await expect(page).toHaveURL(/\/en\/matches/);
  await popup.close();
});

for(const theme of ['dark','light'])for(const width of [320,390,1440]){
  test(`coherent surfaces preserve layout and dialog controls ${theme} ${width}px`,async({page},testInfo)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await installSupabaseMock(page,{notifications:[{id:1001,user_id:own,from_user_id:null,type:'system',message:'Новое событие',read:false,created_at:'2026-10-07T12:00:00Z',rating_id:null,comment_id:null}]});
    await page.setViewportSize({width,height:844});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);
    const layout=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    for(const [url,ready] of [['/discover','.statistics-row'],['/feed','.feed-entry'],[`/profile/${own}`,'.phero']]){
      await page.goto(url+'?__e2e=1');
      await expect(page.locator(ready).first()).toBeVisible();
      await layout();
    }
    if(width<=900){await page.locator('#accountBtn').click();await page.getByRole('menuitem',{name:/Настройки/}).click();}
    else await page.getByRole('button',{name:'Настройки',exact:true}).click();
    await expect(page.locator('#settingsOv')).toBeVisible();
    await layout();
    const save=page.locator('#settingsOv').getByRole('button',{name:'Сохранить',exact:true});
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    await page.locator('#settingsOv').getByRole('button',{name:'Отмена',exact:true}).click();
    await page.locator('#notifBtn').click();
    await expect(page.locator('.notif-item.unread')).toHaveCount(1);
    await layout();
    await page.locator('.notif-read').click();
    await expect(page.locator('.notif-item.unread')).toHaveCount(0);
    await expect(page.locator('#notifUnread')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('.notif-sheet')).toHaveScreenshot(`notifications-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.03});
    await page.screenshot({path:testInfo.outputPath(`surfaces-${theme}-${width}.png`)});
    await page.keyboard.press('Escape');
    await expect(page.locator('#notifBtn')).toBeFocused();
    expect(errors).toEqual([]);
  });
}
