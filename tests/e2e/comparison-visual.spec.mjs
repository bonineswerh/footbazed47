import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
for(const theme of ['dark','light'])for(const width of [390,1440])test(`comparison composition ${theme} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:1000});
  await installSupabaseMock(page);
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
  await page.goto('/profile/cd291181-2db6-42cb-9f3d-ef84ab3a9660?__e2e=1');
  await page.getByRole('button',{name:'Сравнить оценки',exact:true}).click();
  await expect(page.locator('.comparison-match')).toHaveCount(1);await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByRole('dialog',{name:'Сравнение оценок'})).toHaveScreenshot(`comparison-${theme}-${width}.png`,{animations:'disabled',maxDiffPixelRatio:.03});
});
