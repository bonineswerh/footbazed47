import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

for(const theme of ['dark','light'])for(const accent of ['ice','emerald','gold','mono']){
  test(`card CTAs preserve their gradient throughout hover ${theme}/${accent}`,async({page})=>{
    await installSupabaseMock(page,{matches:[
      {id:101,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',status:'finished',home_score:2,away_score:1},
      {id:102,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',home_club_id:24,away_club_id:25,match_date:'2099-10-07T19:00:00Z',status:'scheduled',home_score:null,away_score:null}
    ]});
    await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify(value)),{theme,accent});
    await page.goto('/matches?__e2e=1');
    await expect(page.locator('#matchG .mcard')).toHaveCount(2);
    for(const name of ['Оценить','Ожидание']){
      const button=page.locator('#matchG').getByRole('button',{name,exact:true});
      await page.mouse.move(0,0);
      const gradient=await button.evaluate(el=>getComputedStyle(el).backgroundImage);
      expect(gradient).toContain('gradient');
      await button.hover();
      // Sample multiple animation frames: a final-state assertion misses the flash.
      const samples=await button.evaluate(el=>new Promise(resolve=>{
        const frames=[];let start;
        const sample=time=>{start??=time;const css=getComputedStyle(el);frames.push({image:css.backgroundImage,filter:css.filter});if(time-start<240)requestAnimationFrame(sample);else resolve(frames);};
        requestAnimationFrame(sample);
      }));
      expect(samples.every(frame=>frame.image===gradient)).toBe(true);
      expect(samples.at(-1).filter).toContain('brightness(1.06)');
      await button.click();
      await expect(page.locator('#rateOv')).toBeVisible();
      if(name==='Ожидание')await expect(page.locator('#matchRatingClear')).toHaveAttribute('aria-label','Сбросить ожидание');
      await page.keyboard.press('Escape');
    }
    await page.goto('/?__e2e=1');
    const feature=page.locator('.home-spotlight');
    await expect(feature).toBeVisible();
    const score=feature.locator('.mc-score-link');
    const palette=await feature.evaluate(el=>getComputedStyle(el).backgroundImage);
    await score.hover();
    await expect.poll(()=>score.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await score.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe('none');
    expect(await score.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('0px');
    expect(await feature.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe(palette);
  });
}
