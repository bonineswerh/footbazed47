import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

for(const width of [320,390,1440]){
  test(`profile actions and diary navigation remain usable at ${width}px`,async({page},testInfo)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await installSupabaseMock(page);
    await page.setViewportSize({width,height:1000});
    await page.goto('/profile/3615141a-7700-46b8-9ba5-e4f4450537fc?__e2e=1');
    await expect(page.locator('.phero.is-own-profile')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    const edit=page.getByRole('button',{name:'Редактировать',exact:true});
    const editBox=await edit.boundingBox(),nameBox=await page.locator('.phero-name').boundingBox();
    if(width>900){expect(editBox.y).toBeLessThan(nameBox.y+nameBox.height);expect(editBox.x).toBeGreaterThan(nameBox.x+nameBox.width);}
    await page.getByRole('button',{name:'Перейти к истории оценок',exact:true}).click();
    await expect(page.locator('#diaryTitle')).toBeFocused();
    await edit.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(edit).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath(`profile-${width}.png`),fullPage:true});
    expect(errors).toEqual([]);
  });
}

test('home restores guest copy after logout',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeEditorialTitle')).toHaveText('Матчи, которые стоит обсудить');
  await page.getByRole('button',{name:'Меню аккаунта bazed',exact:true}).click();
  await page.getByRole('menuitem',{name:'Выйти',exact:true}).click();
  await expect(page.locator('#homeEditorialTitle')).toHaveText('Футбол, который остаётся с тобой.',{useInnerText:true});
  await expect(page.locator('#heroBtns').getByRole('button',{name:'Начать свой дневник'})).toBeVisible();
  await expect(page.locator('#homeDashboard')).toBeHidden();
});
