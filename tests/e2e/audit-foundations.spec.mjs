import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const owner='3615141a-7700-46b8-9ba5-e4f4450537fc';
const own={rating_id:502,user_id:owner,match_id:101,match_rating:8,is_public:true,comment:'',created_at:'2026-08-09T11:00:00Z',user:{username:'bazed'},match:{league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1}};
const marks=[{id:24,name:'Real Madrid CF',short_name:'Real Madrid'},{id:31,name:'Manchester City FC',short_name:'Man City'},{id:25,name:'FC Barcelona',short_name:'Barça'}];

test('desktop profile and mobile friends are reachable without search',async({page})=>{
  await installSupabaseMock(page);
  await page.setViewportSize({width:1024,height:900});
  await page.goto('/?__e2e=1');
  const profile=page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Профиль',exact:true});
  await expect(profile).toBeInViewport();
  await page.setViewportSize({width:901,height:900});
  expect(await page.evaluate(()=>{const nav=document.querySelector('.nav-center').getBoundingClientRect(),right=document.querySelector('.nav-right').getBoundingClientRect(),logo=document.querySelector('.logo').getBoundingClientRect();return nav.left>=logo.right&&nav.right<=right.left&&right.right<=innerWidth;})).toBe(true);
  await profile.click();
  await expect(page).toHaveURL(new RegExp('/profile/'+owner));
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Открыть друзей:'}).click();
  await expect(page).toHaveURL(/\/friends/);
  await page.locator('#accountBtn').click();
  await expect(page.getByRole('menuitem',{name:/Друзья|Мой профиль/})).toHaveCount(0);
  await page.getByRole('menuitem',{name:/Настройки/}).click();
  await expect(page.locator('#accountMenu')).toHaveAttribute('aria-hidden','true');
});

for(const theme of ['light','dark'])test('club gradients and long names preserve geometry in '+theme,async({page})=>{
  await installSupabaseMock(page,{clubMarks:marks});
  await page.addInitScript(value=>localStorage.setItem('fbz_appearance',JSON.stringify({theme:value,accent:'ice'})),theme);
  await page.setViewportSize({width:320,height:844});
  await page.goto('/matches?__e2e=1');
  const card=page.locator('#matchG .mcard').first();
  await expect(card).toContainText('Man City');
  await page.evaluate(()=>document.fonts.ready);
  const geometry=await card.evaluate(el=>{
    const box=el.querySelector('.mc-score-block').getBoundingClientRect();
    const errors=[...el.querySelectorAll('.mc-score-name')].map(n=>{
      const r=n.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(n);
      const painted=range.getBoundingClientRect(),mark=n.parentElement.querySelector('.mc-score-mark').getBoundingClientRect();
      return painted.bottom>r.bottom+1||painted.top<r.top-1||painted.top<mark.bottom-1||painted.left<box.left||painted.right>box.right;
    });
    return {errors,background:getComputedStyle(el.querySelector('.mc-score-block')).backgroundImage};
  });
  expect(geometry.errors).toEqual([false,false]);
  expect(geometry.background).toContain('linear-gradient');
  expect(geometry.background).not.toBe('none');
  // Clubs must own the paint even in light theme, rather than the selected accent.
  const firstBackground=geometry.background;
  await page.getByRole('button',{name:'Лента',exact:true}).first().click();
  await expect(page.locator('.feed-team').first()).toContainText('Real Madrid');
  await expect(page.locator('.feed-match').first()).not.toHaveCSS('background-image','none');
  await page.locator('.feed-score').first().click();
  await expect(page).toHaveURL(/\/match\/101/);
  await page.goto('/matches?__e2e=1');
  await page.getByRole('button',{name:'Предстоящие',exact:true}).click();
  const second=page.locator('#matchG .mc-score-block').first();
  await expect(second).toBeVisible();
  expect(await second.evaluate(e=>getComputedStyle(e).backgroundImage)).not.toBe(firstBackground);
});

test('an only owner vote cannot create comparison with other supporters',async({page})=>{
  await installSupabaseMock(page,{feed:[own],matchInsights:{rating_count:1,average:8,others_rating_count:0,others_average:null}});
  await page.goto('/match/101?__e2e=1');
  const comparison=page.locator('.md-rating-comparison');
  await expect(comparison).toContainText('Пока есть только ваша оценка');
  await expect(comparison.locator('.md-comparison-values b')).toHaveText(['8','—','—']);
});

test('overview counts player performances and labels a one-author sample',async({page})=>{
  await installSupabaseMock(page,{feed:[own],lineup:{available:false,players:[]}});
  await page.goto('/discover?__e2e=1&ov_kind=players&ov_participation=all');
  await expect(page.locator('.statistics-row')).toHaveCount(2);
  await expect(page.locator('#statisticsSummary')).toContainText('Оценок выступлений');
  await expect(page.locator('#statisticsSummary strong')).toHaveText(['1','2','1']);
  await expect(page.locator('#statisticsContext')).toContainText('1 автор');
  await expect(page.locator('#statisticsContext')).toContainText('2 ранее сохранённые оценки');
  await expect(page.locator('.statistics-rank')).toHaveText(['·','·']);
  await expect(page.locator('.statistics-row').first()).toContainText('Участие в матче не подтверждено');
});

test('profile keeps the display name independent from its handle and persists closure',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1');
  await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Профиль',exact:true}).click();
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();
  const editor=page.locator('.profile-editor');
  await editor.getByLabel('Никнейм',{exact:true}).fill('bazed_new');
  await editor.getByLabel('Имя в профиле',{exact:true}).fill('Егор');
  await editor.getByLabel('Открытый профиль',{exact:true}).uncheck();
  await expect(page.locator('.profile-visibility')).toContainText('подтверждённым друзьям');
  await page.locator('#epSaveBtn').click();
  await expect(page.locator('.phero-name')).toContainText('Егор');
  const profile=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.profile());
  expect(profile).toMatchObject({username:'bazed_new',display_name:'Егор',is_public:false});
});

test('automatic filters do not submit a second request when finishing',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/discover?__e2e=1');
  await expect(page.locator('.statistics-row')).toHaveCount(1);
  await page.evaluate(()=>{window.__overviewRequests=0;const original=window.__FOOTBAZED_TEST_CLIENT__.rpc;window.__FOOTBAZED_TEST_CLIENT__.rpc=(name,args)=>{if(name==='get_football_statistics')window.__overviewRequests++;return original(name,args);};});
  await page.locator('#statisticsFilters-open').click();
  await page.getByLabel('Минимум оценок').selectOption('5');
  await expect(page.locator('#statisticsList')).toContainText('пока нет оценок');
  await page.getByRole('button',{name:'Готово',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Фильтры'})).toBeHidden();
  expect(await page.evaluate(()=>window.__overviewRequests)).toBe(1);
});

test('account menu releases focus when tabbing outside',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/?__e2e=1');
  await page.locator('#accountBtn').click();
  await page.getByRole('menuitem',{name:'Выйти',exact:true}).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#accountMenu')).toHaveAttribute('aria-hidden','true');
});
