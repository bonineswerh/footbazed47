import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';
const own='3615141a-7700-46b8-9ba5-e4f4450537fc',other='cd291181-2db6-42cb-9f3d-ef84ab3a9660',mutual='2b854020-9701-4f49-9c36-2b65c9dcd449';
async function accessible(page,selector){
  await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
  expect(await page.evaluate(async selector=>(await axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),selector)).toEqual([]);
}
test('expert feed is empty until an editorial author exists and keeps requested tab order',async({page})=>{
  await installSupabaseMock(page);await page.goto('/feed?__e2e=1');
  expect(await page.locator('#feedT button').allTextContents()).toEqual(['Все','Эксперты','Друзья','Мои']);
  await page.getByRole('button',{name:'Эксперты',exact:true}).click();await expect(page.locator('#feedG')).toContainText('Экспертные оценки скоро появятся');await expect(page.locator('.feed-entry')).toHaveCount(0);
});
test('suggestions come from mutual friends and pending requests leave recommendations',async({page})=>{
  await installSupabaseMock(page,{friendships:[{id:1,user_id:own,friend_id:mutual,status:'accepted'},{id:2,user_id:mutual,friend_id:other,status:'accepted'}]});
  await page.goto('/friends?__e2e=1');await page.getByRole('button',{name:'Знакомые',exact:true}).click();
  await expect(page.locator('#friendsContent')).toContainText('gamlet');await expect(page.locator('#friendsContent')).toContainText('1 общий друг');
  await page.locator('#friendsContent').getByRole('button',{name:'Добавить',exact:true}).click();await expect(page.locator('#friendsContent')).not.toContainText('gamlet');await expect(page.locator('#friendsContent')).toContainText('Пока нет рекомендаций');
});
for(const width of [320,390,1440])test(`profile actions and editor preserve context and focus at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await installSupabaseMock(page,{friendships:[{id:1,user_id:own,friend_id:other,status:'accepted'}]});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/profile/'+other+'?__e2e=1');
  const compare=page.getByRole('button',{name:'Сравнить оценки',exact:true});await expect(compare).toBeVisible();await expect(page.getByRole('button',{name:'Заблокировать',exact:true})).toHaveCount(0);
  const friend=page.getByRole('button',{name:/В друзьях/});await friend.click();await expect(page.getByRole('dialog')).toContainText('Удалить из друзей');await expect(page.getByRole('dialog')).toContainText('Пожаловаться');
  await page.keyboard.press('Escape');await expect(friend).toBeFocused();await friend.click();await page.getByRole('button',{name:'Удалить из друзей',exact:true}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.keyboard.press('Escape');await expect(friend).toBeFocused();
  await page.goto('/profile/'+own+'?__e2e=1');const edit=page.getByRole('button',{name:'Редактировать',exact:true});await edit.click();
  await expect(page.getByRole('dialog',{name:'Редактировать профиль',exact:true})).toBeVisible();await expect(page.locator('#profileW .phero')).toBeVisible();await expect(page.getByRole('textbox',{name:'Никнейм'})).toBeFocused();
  await expect(page.locator('#profileEditOv')).toHaveCSS('backdrop-filter','blur(18px)');await accessible(page,'#profileEditOv');await page.keyboard.press('Escape');await expect(edit).toBeFocused();await expect(page.locator('#ep_email')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);expect(errors).toEqual([]);
});
test('league ribbon continues on hover and stops for reduced motion',async({page})=>{
  await installSupabaseMock(page);await page.goto('/?__e2e=1');const track=page.locator('.home-league-track');await expect(track).toBeVisible();await page.locator('#homeLeagueRibbon').hover();await expect(track).toHaveCSS('animation-play-state','running');await page.emulateMedia({reducedMotion:'reduce'});await expect(track).toHaveCSS('animation-name','none');
});
for(const width of [320,390,1440])test(`unconnected profile relationship controls never overlap sharing at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await installSupabaseMock(page);await page.goto('/profile/'+other+'?__e2e=1');
  const trigger=page.getByRole('button',{name:'Действия с пользователем',exact:true});await trigger.click();await expect(page.getByRole('dialog')).toContainText('Заблокировать');await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
  const boxes=await page.locator('.phero-acts').evaluate(e=>({actions:e.getBoundingClientRect().toJSON(),relationship:e.querySelector('.profile-relationship').getBoundingClientRect().toJSON(),more:e.querySelector('.profile-more').getBoundingClientRect().toJSON(),link:e.querySelector('.profile-link').getBoundingClientRect().toJSON()}));
  expect(boxes.more.right).toBeLessThanOrEqual(boxes.relationship.right+1);expect(boxes.relationship.right).toBeLessThanOrEqual(boxes.link.left+1);
});
for(const width of [320,390,1440])test(`tall Tottenham logo stays inside mark and clear of name at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});const url='https://media.api-sports.io/football/teams/47.png';
  await installSupabaseMock(page,{matches:[{id:101,home_team_name:'Tottenham Hotspur FC',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,league_name:'Premier League',match_date:'2026-10-06T12:00:00Z',home_score:2,away_score:1,status:'finished'}],clubMarks:[{id:24,name:'Tottenham Hotspur FC',media:{asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url}}]});
  await page.route(url,route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="180"><path fill="#fff" d="M20 0h40v160H20z"/></svg>'}));
  await page.goto('/matches?__e2e=1');await expect(page.locator('#matchG .has-image img').first()).toBeVisible();
  const boxes=await page.locator('#matchG .has-image').first().evaluate(mark=>({mark:mark.getBoundingClientRect().toJSON(),img:mark.querySelector('img').getBoundingClientRect().toJSON(),name:mark.nextElementSibling.getBoundingClientRect().toJSON()}));
  expect(boxes.img.bottom).toBeLessThanOrEqual(boxes.mark.bottom+1);expect(boxes.img.bottom).toBeLessThan(boxes.name.top);
});
test('confirmed like becomes red and filled, unliking restores outline',async({page})=>{
  await installSupabaseMock(page);await page.goto('/feed?__e2e=1');const like=page.locator('.like-action:not([disabled])').first();await expect(like).toHaveAttribute('aria-pressed','false');await like.click();await expect(like).toHaveAttribute('aria-pressed','true');
  const red=await page.evaluate(()=>{const probe=document.createElement('i');probe.style.color='var(--rating-low)';document.body.append(probe);const value=getComputedStyle(probe).color;probe.remove();return value;});await expect(like.locator('.ico')).toHaveCSS('color',red);await expect(like.locator('small')).toHaveCSS('color',red);
  await expect(like.locator('svg')).toHaveCSS('fill',red);await like.click();await expect(like).toHaveAttribute('aria-pressed','false');await expect(like.locator('svg')).toHaveCSS('fill','none');
});
test('expert feed displays the server-authorized label without labelling ordinary authors',async({page})=>{
  await installSupabaseMock(page);
  await page.addInitScript(()=>{
    const rpc=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__expertScopes=[];
    window.__FOOTBAZED_TEST_CLIENT__.rpc=async(name,args)=>{
      if(name!=='get_social_feed_page')return rpc(name,args);
      window.__expertScopes.push(args.p_scope);
      const result=await rpc(name,{...args,p_scope:'all'});
      result.data.items[0].user.is_expert=true;
      if(args.p_scope==='experts')result.data.items=result.data.items.slice(0,1);
      return result;
    };
  });
  await page.goto('/feed?__e2e=1');await expect(page.locator('.feed-entry')).toHaveCount(2);await expect(page.locator('.feed-expert-label')).toHaveCount(1);
  await page.getByRole('button',{name:'Эксперты',exact:true}).click();await expect(page.locator('.feed-entry')).toHaveCount(1);await expect(page.locator('.feed-expert-label')).toHaveText('Эксперт FOOTBAZED');await accessible(page,'#page-feed');
  expect(await page.evaluate(()=>window.__expertScopes)).toEqual(['all','experts']);
});
test('administrator can retry, appoint and revoke an expert without deleting the author',async({page})=>{
  await installSupabaseMock(page);let failed=false;const calls=[],items=[];
  await page.route('**/api/admin*',async route=>{
    const body=route.request().postDataJSON();let data={counts:{},recentMatches:[],footballApiConfigured:false,apiFootballConfigured:false},status=200;
    if(body?.action==='community_experts'){
      calls.push(body);
      if(!failed){failed=true;status=503;data={error:'private server diagnostics'};}
      else{
        if(body.enabled===true)items.push({username:body.username,display_name:'Gamlet',is_public:true});
        if(body.enabled===false)items.splice(0,items.length);
        data={items};
      }
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/admin?__e2e=1');await page.getByRole('button',{name:'Эксперты',exact:true}).click();
  await page.getByRole('button',{name:'Обновить список экспертов',exact:true}).click();await expect(page.locator('#adminExpertList')).toContainText('Эксперты пока не назначены');
  await page.getByRole('textbox',{name:'Никнейм пользователя',exact:true}).fill('@gamlet');await page.getByRole('button',{name:'Назначить экспертом',exact:true}).click();await expect(page.locator('#adminExpertList')).toContainText('@gamlet');await expect(page.locator('#toast')).toContainText('Эксперт назначен');
  await accessible(page,'#admin-view-experts');await page.getByRole('button',{name:'Снять роль',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'Снять роль',exact:true}).click();
  await expect(page.locator('#adminExpertList')).toContainText('Эксперты пока не назначены');await expect(page.locator('#toast')).toContainText('Роль эксперта снята');
  expect(calls).toEqual([{action:'community_experts',username:null,enabled:null},{action:'community_experts',username:null,enabled:null},{action:'community_experts',username:'gamlet',enabled:true},{action:'community_experts',username:'gamlet',enabled:false}]);
});
for(const theme of ['dark','light'])test(`favorite star remains blue and filled across calendar and club in ${theme}`,async({page})=>{
  await installSupabaseMock(page);await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
  const blue=async()=>page.evaluate(()=>{const e=document.createElement('i');e.style.color='var(--rating-elite)';document.body.append(e);const color=getComputedStyle(e).color;e.remove();return color;});
  await page.goto('/matches?__e2e=1');const filter=page.locator('.calendar-favorites');await filter.click();await expect(filter).toHaveAttribute('aria-pressed','true');await expect(filter.locator('svg')).toHaveCSS('fill',await blue());
  await page.goto('/club/24?__e2e=1');const favorite=page.locator('.entity-favorite');await expect(favorite).toHaveAttribute('aria-pressed','true');await expect(favorite.locator('svg')).toHaveCSS('fill',await blue());await favorite.click();await expect(favorite).toHaveAttribute('aria-pressed','false');await expect(favorite.locator('svg')).toHaveCSS('fill','none');
});
