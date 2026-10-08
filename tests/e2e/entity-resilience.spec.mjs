import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const pageErrors=new WeakMap();
test.beforeEach(async({page})=>{
  const errors=[];
  pageErrors.set(page,errors);
  page.on('pageerror',error=>errors.push(error.message));
  await installSupabaseMock(page);
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,route=>route.abort());
});
test.afterEach(async({page})=>{expect(pageErrors.get(page)).toEqual([]);});

test('ошибка загрузки клуба предлагает повтор, а отсутствующий клуб — поиск',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
  await page.evaluate(async()=>{
    const original=sb.rpc.bind(sb);
    let fail=true;
    sb.rpc=(name,args)=>{
      if(name==='get_club_page'&&fail){fail=false;return Promise.resolve({data:null,error:{message:'network_failure'}});}
      return original(name,args);
    };
    await FBZEntities.loadClub(24);
  });
  await expect(page.getByRole('heading',{name:'Не удалось загрузить страницу'})).toBeVisible();
  await expect(page.locator('.entity-empty-code')).toHaveCount(0);
  await expect(page.locator('#clubC')).toHaveAttribute('aria-busy','false');
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
  await page.evaluate(()=>go('club',{id:999}));
  await expect(page.getByRole('heading',{name:'Клуб не найден'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Открыть поиск',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/club\/999\?__e2e=1$/u);
});

test('поздний ответ клуба не меняет заголовок и metadata страницы игрока',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>{
      const result=original(name,args);
      if(name==='get_club_page')return new Promise(resolve=>{window.releaseClub=()=>resolve(result);});
      return result;
    };
    window.slowClub=FBZEntities.loadClub(24);
    go('player',{id:5290});
  });
  await expect(page.locator('.entity-hero h1')).toHaveText('Thibaut Courtois');
  await page.evaluate(async()=>{window.releaseClub();await window.slowClub;});
  await expect(page).toHaveTitle(/Thibaut Courtois/u);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/player\/5290$/u);
  await expect(page.locator('.entity-hero h1')).toHaveText('Thibaut Courtois');
});

test('избранное завершает запись для исходного клуба после перехода к другому',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('#clubFavoriteButton')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(async()=>{
    const original=sb.rpc.bind(sb);
    const other=structuredClone((await original('get_club_page',{p_club_id:24})).data);
    other.club={...other.club,id:31,name:'Manchester City FC'};
    other.is_favorite=true;
    sb.rpc=(name,args)=>{
      if(name==='get_club_page'&&Number(args.p_club_id)===31)return Promise.resolve({data:other,error:null});
      const result=original(name,args);
      if(name==='set_favorite_club')return new Promise(resolve=>{window.releaseFavorite=()=>resolve(result);});
      return result;
    };
    window.slowFavorite=FBZEntities.toggleFavorite();
  });
  await expect(page.locator('#clubFavoriteButton')).toBeDisabled();
  await page.evaluate(()=>go('club',{id:31}));
  await expect(page.locator('.entity-hero h1')).toHaveText('Манчестер Сити');
  await page.evaluate(async()=>{window.releaseFavorite();await window.slowFavorite;});
  await expect(page.locator('#clubFavoriteButton')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#clubFavoriteButton')).toBeEnabled();
  await expect(page.locator('.entity-hero h1')).toHaveText('Манчестер Сити');
  expect(await page.evaluate(()=>CU.favorite_clubs.some(club=>Number(club.id)===24))).toBe(false);
});

test('избранное сохраняет вкладку и фокус после ошибки и повторной записи',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('#clubFavoriteButton')).toBeVisible();
  await page.getByRole('tab',{name:/Состав/u}).click();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    let fail=true;
    sb.rpc=(name,args)=>{
      if(name==='set_favorite_club'&&fail){fail=false;return Promise.resolve({data:null,error:{message:'offline'}});}
      if(name==='get_my_favorite_clubs')return Promise.resolve({data:null,error:{message:'secondary_failure'}});
      return original(name,args);
    };
  });
  const favorite=page.locator('#clubFavoriteButton');
  await favorite.focus();
  await favorite.press('Enter');
  await expect(favorite).toBeEnabled();
  await expect(favorite).toHaveAttribute('aria-pressed','true');
  await favorite.press('Enter');
  await expect(favorite).toHaveAttribute('aria-pressed','false');
  await expect(favorite).toBeFocused();
  await expect(page.getByRole('tab',{name:/Состав/u})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#clubBody .squad-player')).toHaveCount(3);
});

for(const width of [320,390,1440]){
  test(`вкладки клуба доступны с клавиатуры, кнопки удобны при ширине ${width}`,async({page})=>{
    await page.setViewportSize({width,height:width<600?844:1000});
    await page.goto('/club/24?__e2e=1');
    const overview=page.getByRole('tab',{name:'Обзор',exact:true});
    await expect(overview).toBeVisible();
    await overview.focus();
    await page.keyboard.press('ArrowRight');
    const squad=page.getByRole('tab',{name:/Состав/u});
    await expect(squad).toBeFocused();
    await expect(squad).toHaveAttribute('aria-selected','true');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','club-tab-squad');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab',{name:/Матчи/u})).toBeFocused();
    await page.keyboard.press('Home');
    await expect(overview).toBeFocused();
    for(const theme of ['dark','light']){
      for(const accent of ['emerald','ice','gold','mono']){
        await page.evaluate(({theme,accent})=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.accent=accent;},{theme,accent});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
        const sizes=await page.locator('.entity-hero-actions button,.entity-tab').evaluateAll(items=>items.map(item=>({width:item.getBoundingClientRect().width,height:item.getBoundingClientRect().height})));
        expect(sizes.every(size=>size.width>=44&&size.height>=44)).toBe(true);
      }
    }
  });
}

test('ошибка verified-изображения возвращает инициалы без broken image',async({page})=>{
  await page.route('https://images.unsplash.com/expired-club.png',route=>route.abort());
  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('.entity-hero h1')).toHaveText('Реал Мадрид');
  await page.evaluate(async()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>{
      if(name!=='get_club_page')return original(name,args);
      return original(name,args).then(result=>{
        result.data.club.media={asset_type:'club_logo',usage_status:'verified',url:'https://images.unsplash.com/expired-club.png'};
        return result;
      });
    };
    await FBZEntities.loadClub(24);
  });
  await expect(page.locator('.entity-mark.is-fallback')).toHaveText('RM');
  await expect(page.locator('.entity-mark img')).toHaveCount(0);
  await expect(page.locator('.entity-mark')).toHaveAttribute('role','img');
});

test('медленный ответ матча не заменяет новый матч и его canonical',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-hero')).toContainText('Ман Сити');
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>{
      const result=original(name,args);
      if(name==='get_match_insights'&&Number(args.p_match_id)===101)return new Promise(resolve=>{window.releaseMatch=()=>resolve(result);});
      return result;
    };
    window.slowMatch=loadMD(101);
    go('md',{mid:102});
  });
  await expect(page.locator('.md-hero')).toContainText('Барселона');
  await page.evaluate(async()=>{window.releaseMatch();await window.slowMatch;});
  await expect(page.locator('.md-hero')).toContainText('Барселона');
  await expect(page.locator('.md-hero')).not.toContainText('Ман Сити');
  await expect(page).toHaveURL(/\/match\/102\?__e2e=1$/u);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/match\/102$/u);
  await expect(page).toHaveTitle(/Барселона/u);
});

test('переоткрытая оценка игнорирует поздние данные предыдущего матча',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-hero')).toBeVisible();
  await page.evaluate(async()=>{
    await FBZRatingsLoader.load();
    const original=sb.from.bind(sb);
    let first=true;
    sb.from=table=>{
      const builder=original(table);
      if(table==='matches'){
        const single=builder.single.bind(builder);
        builder.single=()=>{
          const result=single().then(response=>({...response,data:{...response.data,status:'finished'}}));
          if(first){first=false;return new Promise(resolve=>{window.releaseRating=()=>resolve(result);});}
          return result;
        };
      }
      return builder;
    };
    window.slowRating=openRate(101);
  });
  await expect(page.locator('#rSave')).toBeDisabled();
  await page.getByRole('button',{name:'Закрыть окно оценки'}).click();
  await page.evaluate(()=>openRate(102));
  await expect(page.locator('#rMI')).toContainText('Барселона');
  await expect(page.locator('#rScoreDisp')).toHaveText('—');
  await page.evaluate(async()=>{window.releaseRating();await window.slowRating;});
  await expect(page.locator('#rMI')).toContainText('Барселона');
  await expect(page.locator('#rScoreDisp')).toHaveText('—');
  await expect(page.locator('#rDelete')).toBeHidden();
  await page.locator('.rating-supporter-options label').filter({has:page.locator('input[value="neutral"]')}).click();
  await expect(page.locator('input[name="ratingSupporterSide"][value="neutral"]')).toBeChecked();
  await page.locator('#matchRatingRange').fill('7');
  await page.getByRole('button',{name:/Продолжить/u}).click();
  await page.locator('#rSave').click();
  await expect(page.locator('#rateOv')).toBeHidden();
  const payload=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating());
  expect(payload.p_match_id).toBe(102);
  expect(payload.p_player_ratings).toEqual([]);
  expect(payload.p_match_rating).toBe(7);
});

test('сохранение закрытой оценки не закрывает заново открытый редактор',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-primary-action')).toBeVisible();
  await page.locator('.md-primary-action').click();
  await expect(page.locator('#rScoreDisp')).toHaveText('8/10');
  await page.getByRole('button',{name:/Продолжить/u}).click();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>{
      const result=original(name,args);
      if(name!=='save_match_rating')return result;
      const pending=new Promise(resolve=>{window.releaseSave=()=>resolve(result);});
      pending.single=()=>pending;
      return pending;
    };
    window.slowSave=saveRating();
  });
  await expect(page.locator('#rSave')).toBeDisabled();
  await page.getByRole('button',{name:'Закрыть окно оценки'}).click();
  await page.evaluate(()=>openRate(101));
  await expect(page.locator('#rSave')).toBeEnabled();
  await page.locator('#matchRatingRange').fill('6');
  await page.evaluate(async()=>{window.releaseSave();await window.slowSave;});
  await expect(page.locator('#rateOv')).toBeVisible();
  await expect(page.locator('#rScoreDisp')).toHaveText('6/10');
  await expect(page.locator('#rSave')).toBeEnabled();
});

test('главная не показывает устаревшую серию профиля',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('#homeDashboardTitle')).toContainText('Bazed');
  await page.evaluate(()=>FBZHome.sync({...CU,streak:14,streak_date:'2020-01-01'}));
  await expect(page.locator('#homeOverview .home-overview-item').nth(2)).toContainText('начните с одного матча');
  await expect(page.locator('#homeOverview .home-overview-item').nth(2).locator('strong')).toHaveText('—');
});
