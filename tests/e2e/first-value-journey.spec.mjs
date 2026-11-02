import {test,expect} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const newcomer={id:'3615141a-7700-46b8-9ba5-e4f4450537fc',username:'bazed',display_name:'Bazed',ratings_count:0,avg_rating:null,is_public:true};

for(const width of [320,390,1440])for(const theme of ['dark','light'])for(const accent of width===390?['ice','emerald','gold','mono']:['ice'])test(`first steps lead to scoped search and community at ${width}px ${theme} ${accent}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await installSupabaseMock(page,{profile:newcomer,favoriteClubs:[],ratings:[]});
  await page.addInitScript(appearance=>localStorage.setItem('fbz_appearance',JSON.stringify(appearance)),{theme,accent});
  await page.setViewportSize({width,height:900});
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toHaveText('Ваш первый матч в FOOTBAZED');
  await expect(page.locator('#homeOverview .home-first-step')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator('#homeOverview').screenshot({path:testInfo.outputPath(`first-steps-${width}.png`)});
  if(width===390&&accent==='ice'){
    await page.addScriptTag({url:'/node_modules/axe-core/axe.min.js'});
    const violations=await page.evaluate(async()=>{const result=await axe.run(document.querySelector('#homeOverview'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.filter(x=>['critical','serious','moderate'].includes(x.impact)).map(x=>x.id);});
    expect(violations).toEqual([]);
  }
  await page.getByRole('button',{name:/Оценить первый матч/}).click();
  await expect(page.locator('.search-categories').getByRole('button',{name:'Матчи',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#globalSearchInput')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Выбрать любимый клуб/}).click();
  await expect(page.locator('.search-categories').getByRole('button',{name:'Клубы',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:/Лента Посмотреть оценки/}).click();
  await expect(page).toHaveURL(/\/feed\?/);
  expect(errors).toEqual([]);
});

test('favourite calendar shortcut clears stale date, status and search but keeps back navigation',async({page})=>{
  await installSupabaseMock(page);
  await page.goto('/matches?__e2e=1&m_day=2026-08-08');
  await page.locator('#mf').getByRole('button',{name:'Предстоящие',exact:true}).click();
  await page.locator('#msearch').fill('No such club');
  await page.getByRole('navigation',{name:'Основная навигация'}).getByRole('button',{name:'Главная',exact:true}).click();
  await page.getByRole('button',{name:'Избранное',exact:true}).click();
  await expect(page).toHaveURL(/\/matches\?.*m_favorites=1/);
  expect(new URL(page.url()).searchParams.has('m_day')).toBe(false);
  await expect(page.locator('.calendar-favorites')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#mf').getByRole('button',{name:'Все',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#msearch')).toHaveValue('');
  const calls=await page.evaluate(()=>window.__FOOTBAZED_TEST_CALENDAR__.calls());
  expect(calls.at(-1).p_filters).toMatchObject({favorites_only:true,status:'all',query:''});
  await page.goBack();
  await expect(page.locator('#homeDashboard')).toBeVisible();
});

test('English newcomers get translated first steps and scoped search',async({page})=>{
  await installSupabaseMock(page,{profile:newcomer,favoriteClubs:[]});
  await page.goto('/en/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toHaveText('Your first match on FOOTBAZED');
  await page.getByRole('button',{name:/Rate your first match/}).click();
  await expect(page.locator('.search-categories').getByRole('button',{name:'Matches',exact:true})).toHaveAttribute('aria-pressed','true');
});
