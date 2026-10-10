import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';

for(const width of [320,390,1440])for(const names of [['РПЛ'],['Premier League','La Liga','UEFA Champions League']])test(`tournament ribbon has no empty end or seam: ${width}, ${names.length} leagues`,async({page},testInfo)=>{
  await installSupabaseMock(page);await page.setViewportSize({width,height:1000});await page.goto('/?__e2e=1');
  await expect(page.locator('.home-league-track')).toBeVisible();await page.evaluate(names=>FBZHome.leagues(names),names);await page.evaluate(()=>document.fonts.ready);
  const track=page.locator('.home-league-track');
  const result=await track.evaluate(el=>{
    const halves=[...el.children],view=el.parentElement.getBoundingClientRect(),a=el.getAnimations()[0];a.pause();
    const duration=a.effect.getTiming().duration;
    const phases=[0,duration/2,duration-1,duration+1,2*duration+1].map(time=>{
      a.currentTime=time;
      const visible=[...el.querySelectorAll('span')].map(s=>s.getBoundingClientRect()).filter(r=>r.right>view.left&&r.left<view.right).sort((x,y)=>x.left-y.left);
      return {count:visible.length,gap:Math.max(visible[0].left-view.left,view.right-visible.at(-1).right,...visible.slice(1).map((r,i)=>r.left-visible[i].right)),left:visible[0].left};
    });
    a.play();return {widths:halves.map(x=>x.offsetWidth),identical:halves[0].innerHTML===halves[1].innerHTML,view:view.width,phases,iterations:a.effect.getTiming().iterations};
  });
  expect(result.identical).toBe(true);expect(result.widths[0]).toBe(result.widths[1]);expect(result.widths[0]).toBeGreaterThanOrEqual(result.view);expect(result.iterations).toBe(Infinity);
  for(const phase of result.phases){expect(phase.count).toBeGreaterThan(0);expect(phase.gap).toBeLessThanOrEqual(32);}
  expect(Math.abs(result.phases[2].left-result.phases[3].left)).toBeLessThan(1);
  await page.locator('#homeLeagueRibbon').hover();await expect(track).toHaveCSS('animation-play-state','running');
  const pause=page.getByRole('button',{name:'Остановить движение турниров',exact:true});await pause.click();await expect(track).toHaveCSS('animation-play-state','paused');
  const resume=page.getByRole('button',{name:'Продолжить движение турниров',exact:true});await expect(resume).toHaveAttribute('aria-pressed','true');await resume.click();await expect(track).toHaveCSS('animation-play-state','running');
  await testInfo.attach('ribbon.png',{body:await page.locator('.home-ribbon-shell').screenshot({animations:'disabled'}),contentType:'image/png'});
  await page.emulateMedia({reducedMotion:'reduce'});await expect(track).toHaveCSS('animation-name','none');await expect(page.locator('.home-ribbon-toggle')).toBeHidden();
  await expect(track.locator('div').first().locator('span:visible')).toHaveCount(names.length);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

for(const theme of ['dark','light'])test(`overview hover retains the same palette and geometry: ${theme}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await installSupabaseMock(page);await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);await page.goto('/discover?__e2e=1');
  for(const kind of ['matches','clubs','players','leagues']){
    await page.locator(`.statistics-tabs [data-kind="${kind}"]`).click();const row=page.locator('.statistics-row').first();await expect(row).toBeVisible();await page.mouse.move(0,0);
    const read=()=>row.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),p=getComputedStyle(el,'::before');return {x:r.x,y:r.y,width:r.width,height:r.height,paint:s.backgroundImage,transform:s.transform,opacity:p.opacity,pointer:p.pointerEvents};});
    const idle=await read();await row.hover({position:{x:2,y:2}});await expect.poll(async()=>(await read()).opacity).toBe('1');
    for(const position of [{x:16,y:16},{x:idle.width-16,y:idle.height-16},{x:idle.width/2,y:idle.height/2}]){await row.hover({position});const hover=await read();expect({...hover,opacity:idle.opacity}).toEqual(idle);}
    await page.mouse.move(0,0);await expect.poll(async()=>(await read()).opacity).toBe('0');await page.keyboard.press('Tab');await row.focus();await expect.poll(async()=>(await read()).opacity).toBe('1');
  }
  await page.locator('.statistics-method-details summary').click();await expect(page.locator('.statistics-scale span')).toHaveText(['1–3','4–6','7–8','9–10']);expect(errors).toEqual([]);
});

for(const width of [320,390,664,1440])for(const theme of ['dark','light'])test(`upcoming match reuses hero summary and personal rating layout: ${theme} ${width}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:1000});await installSupabaseMock(page,{matches:[{id:102,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',home_club_id:24,away_club_id:25,match_date:'2099-08-20T19:00:00Z',status:'scheduled',home_score:null,away_score:null}],expectations:[{user_id:own,match_id:102,rating:9,supporter_side:'home'},{user_id:other,match_id:102,rating:5,supporter_side:'neutral'}]});
  await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'ice'})),theme);await page.goto('/match/102?__e2e=1');await expect(page.locator('#mdExpectationSummary')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.md-hero .md-ci')).toHaveCount(3);await expect(page.locator('.md-hero .md-segment')).toHaveCount(4);await expect(page.locator('.md-ci .md-cv')).toHaveText(['7.0','2','—']);await expect(page.locator('.md-own-rating.expectation-personal')).toContainText('9.0');await expect(page.locator('.expectation-panel')).toHaveCount(0);
  const segment=page.locator('[data-expectation-segment="home"]');await segment.click();await expect(page.locator('.md-ci .md-cv')).toHaveText(['9.0','1','—']);await expect(segment).toBeFocused();await expect(segment).toHaveAttribute('aria-pressed','true');await page.locator('[data-expectation-segment="away"]').click();await expect(page.locator('.md-ci .md-cv')).toHaveText(['—','0','—']);
  await page.locator('[data-expectation-segment="all"]').click();await page.evaluate(()=>document.fonts.ready);
  expect(await page.locator('.md-segment>span').evaluateAll(labels=>labels.every(el=>el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1))).toBe(true);
  if(width===390){await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});expect(await page.evaluate(async()=>(await axe.run(document.querySelector('#page-md'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.filter(v=>['critical','serious','moderate'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})))).toEqual([]);}
  await testInfo.attach('upcoming.png',{body:await page.screenshot({path:testInfo.outputPath('upcoming.png')}),contentType:'image/png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});

test('upcoming expectations have a real error and retry without a fabricated aggregate',async({page})=>{
  await installSupabaseMock(page,{expectationError:true});await page.goto('/match/102?__e2e=1');await expect(page.locator('.expectation-error')).toBeVisible();await expect(page.locator('#mdExpectationSummary .md-comm')).toHaveCount(0);
  await page.evaluate(()=>{const rpc=sb.rpc.bind(sb);sb.rpc=(name,args)=>name==='get_match_expectations'?Promise.resolve({data:{is_open:false,own:null,segments:{all:{count:0,average:null}}},error:null}):rpc(name,args);});
  await page.locator('.expectation-error button').click();await expect(page.locator('.md-ci .md-cv')).toHaveText(['—','0','—']);await expect(page.locator('.expectation-error')).toHaveCount(0);
});
