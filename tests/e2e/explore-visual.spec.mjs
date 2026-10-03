import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const owner='3615141a-7700-46b8-9ba5-e4f4450537fc';
for(const theme of ['dark','light'])for(const width of [390,1440]){
  test(`overview and diary composition ${theme} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:1000});
    await installSupabaseMock(page);
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
    await page.goto('/discover?__e2e=1');
    await expect(page.locator('.statistics-row')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
    await expect(page.locator('#statisticsRoot')).toHaveScreenshot(`overview-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.03});
    await page.locator('#statisticsFilters-open').click();
    await expect(page.getByRole('button',{name:'Готово'})).toBeInViewport();
    await expect(page.getByRole('dialog',{name:'Фильтры'})).toHaveScreenshot(`filters-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.03});
    await page.keyboard.press('Escape');
    await page.goto(`/profile/${owner}?__e2e=1`);
    await expect(page.locator('.diary-month')).toBeVisible();
    await expect(page.locator('.pcard').filter({has:page.locator('#diaryTitle')})).toHaveScreenshot(`diary-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.03});
  });
}
