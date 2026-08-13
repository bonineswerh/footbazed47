import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

test.beforeEach(async({page})=>{
  await installSupabaseMock(page);
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,route=>route.abort());
});

test('авторизованная главная показывает личный футбольный экран',async({page})=>{
  await page.goto('/?__e2e=1#home');

  await expect(page.locator('#homeDashboard')).toBeVisible();
  await expect(page.locator('.guest-home-intro')).toBeHidden();
  await expect(page.locator('#homeDashboardTitle')).toContainText('Bazed');
  await expect(page.locator('#homeOverview .home-overview-item')).toHaveCount(3);
  await expect(page.locator('#homePendingRatings')).toContainText('Всё оценено');
  await expect(page.locator('#homeFavoriteTeams')).toContainText('Real Madrid');
  await expect(page.getByRole('button',{name:'Рейтинги',exact:true}).first()).toBeVisible();
});

test('меню аккаунта полностью управляется с клавиатуры',async({page})=>{
  await page.goto('/?__e2e=1#home');
  const trigger=page.locator('#accountBtn');
  const menu=page.locator('#accountMenu');

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(menu).toHaveAttribute('aria-hidden','false');
  await expect(menu.getByRole('menuitem').first()).toBeFocused();

  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem',{name:'Выйти'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(trigger).toBeFocused();
});

test('admin assets load only after an authorized admin opens the panel',async({page})=>{
  const adminAssets=[];
  page.on('request',request=>{
    if(/\/(?:js\/admin\.js|admin\.css)(?:\?|$)/u.test(new URL(request.url()).pathname))adminAssets.push(request.url());
  });
  await page.route('**/api/admin*',route=>route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({counts:{matches:2,players:3,ratings:4,users:5,predictions:6,upcoming:1,legacyAvatars:0},recentMatches:[],footballApiConfigured:true})
  }));

  await page.goto('/?__e2e=1#home');
  await expect(page.locator('#homeDashboardTitle')).toBeVisible();
  expect(adminAssets).toEqual([]);

  await page.evaluate(()=>go('admin'));
  await expect(page.locator('#adminMetrics .admin-metric')).toHaveCount(5);
  expect(adminAssets.some(url=>url.includes('/js/admin.js'))).toBe(true);
  expect(adminAssets.some(url=>url.includes('/admin.css'))).toBe(true);
});

test('авторизованный пользователь управляет реакциями и комментариями в ленте',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/?__e2e=1#feed');

  await expect(page.getByRole('heading',{name:'Лента',exact:true})).toBeVisible();
  await expect(page).toHaveTitle('Лента — FOOTBAZED');
  await expect(page.locator('#accountBtn')).toContainText('bazed');

  const entry=page.locator('.feed-entry[data-rating-id="501"]');
  await expect(entry).toContainText('Сильный второй тайм');
  await expect(entry.locator('.feed-rating')).toHaveText('10/10');
  await expect(entry.locator('.feed-verdict')).toHaveAttribute('data-tone','elite');
  const feedRatingPaint=await entry.locator('.feed-rating strong').evaluate(element=>({
    color:getComputedStyle(element).color,
    background:getComputedStyle(element).backgroundColor,
    text:element.textContent
  }));
  expect(feedRatingPaint).toEqual({color:'rgb(56, 189, 248)',background:'rgba(0, 0, 0, 0)',text:'10'});
  const like=entry.locator('.like-action');
  await expect(like.locator('span')).toHaveText('3');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed','true');
  await expect(like.locator('span')).toHaveText('4');

  await entry.getByRole('button',{name:/Обсудить/}).click();
  await expect(entry.getByText('Согласен насчёт второго тайма.')).toBeVisible();
  await entry.getByPlaceholder('Написать комментарий').fill('Новая мысль после матча.');
  await entry.locator('.comment-form button[type="submit"]').click();
  const created=entry.locator('.feed-comment').filter({hasText:'Новая мысль после матча.'});
  await expect(created).toBeVisible();
  await expect(entry.locator('[data-comment-count]')).toHaveText('62');
  await created.getByRole('button',{name:'Удалить комментарий'}).click();
  await expect(created).toHaveCount(0);
  await expect(entry.locator('[data-comment-count]')).toHaveText('61');
  expect(pageErrors).toEqual([]);
});

test('страница клуба открывает игрока и возвращает в клуб',async({page})=>{
  await page.goto('/club/24?__e2e=1');

  await expect(page.getByRole('heading',{name:'Real Madrid CF',exact:true})).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://footbazed47.vercel.app/club/24');
  expect(await page.locator('#fbzStructuredData').textContent()).toContain('SportsTeam');
  await expect(page.getByText('Santiago Bernabéu')).toBeVisible();
  await page.getByRole('tab',{name:/Состав/}).click();
  await page.getByRole('button',{name:/Thibaut Courtois/}).click();

  await expect(page).toHaveURL(/\/player\/5290\?__e2e=1$/u);
  await expect(page.getByRole('heading',{name:'Thibaut Courtois',exact:true})).toBeVisible();
  await expect(page.getByText('Средняя оценка')).toBeVisible();
  await page.getByRole('button',{name:'Real Madrid CF',exact:true}).click();
  await expect(page).toHaveURL(/\/club\/24\?__e2e=1$/u);
  await expect(page.getByRole('heading',{name:'Real Madrid CF',exact:true})).toBeVisible();
});

test('публичный URL матча получает canonical и SportsEvent metadata',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-hero')).toContainText('Real Madrid CF');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://footbazed47.vercel.app/match/101');
  expect(await page.locator('#fbzStructuredData').textContent()).toContain('SportsEvent');
});

test('клуб, игрок и турнир работают без production media',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));

  await page.goto('/club/24?__e2e=1');
  await expect(page.locator('.entity-mark.is-fallback')).toContainText('RM');
  await expect(page.locator('.entity-mark img')).toHaveCount(0);

  await page.goto('/player/5290?__e2e=1');
  await expect(page.locator('.player-mark.is-fallback')).toContainText('TC');
  await expect(page.locator('.player-mark img')).toHaveCount(0);

  await page.goto('/competition/7?__e2e=1');
  await expect(page.getByRole('heading',{name:'Champions League',exact:true})).toBeVisible();
  await expect(page.locator('.entity-mark.is-fallback')).toContainText('CL');
  await expect(page.locator('.competition-club-grid>button')).toHaveCount(2);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://footbazed47.vercel.app/competition/7');
  expect(pageErrors).toEqual([]);
});

test('избранный клуб добавляется, повторно не дублируется и удаляется через RPC',async({page})=>{
  await page.goto('/club/24?__e2e=1');
  const favorite=page.locator('#clubFavoriteButton');
  await expect(favorite).toHaveAttribute('aria-pressed','true');
  await favorite.click();
  await expect(page.locator('#clubFavoriteButton')).toHaveAttribute('aria-pressed','false');
  await page.locator('#clubFavoriteButton').click();
  await expect(page.locator('#clubFavoriteButton')).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.locator('#clubFavoriteButton')).toHaveAttribute('aria-pressed','true');

  await page.evaluate(async()=>{
    await sb.rpc('set_favorite_club',{p_club_id:24,p_favorite:true});
    await sb.rpc('set_favorite_club',{p_club_id:24,p_favorite:true});
  });
  const favorites=await page.evaluate(async()=>(await sb.rpc('get_my_favorite_clubs')).data);
  expect(favorites.filter(club=>club.id===24)).toHaveLength(1);
});

test('глобальный поиск открывает страницу турнира без зависимости от логотипа',async({page})=>{
  const searchRequests=[];
  page.on('request',request=>{
    if(new URL(request.url()).pathname==='/js/search.js')searchRequests.push(request.url());
  });
  await page.goto('/?__e2e=1#home');
  expect(searchRequests).toHaveLength(0);
  await page.getByRole('button',{name:'Поиск'}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await expect.poll(()=>searchRequests.length).toBe(1);
  await page.getByRole('button',{name:'Закрыть поиск'}).click();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  expect(searchRequests).toHaveLength(1);
  await page.locator('#globalSearchInput').fill('Champions');
  const result=page.getByRole('option',{name:/Champions League/});
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/competition\/7\?__e2e=1$/u);
  await expect(page.getByRole('heading',{name:'Champions League',exact:true})).toBeVisible();
});

test('страница матча сравнивает личную оценку с сообществом',async({page})=>{
  await page.goto('/match/101?__e2e=1');

  const comparison=page.locator('.md-rating-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison).toContainText('Вы оценили матч ниже сообщества');
  await expect(comparison).toContainText('8');
  await expect(comparison).toContainText('8.5');
  await expect(comparison).toContainText('-0.5');
  await expect(page.getByRole('button',{name:/Изменить оценку/})).toBeVisible();

  const topPlayerRow=page.locator('.pr-row').first();
  await expect(topPlayerRow).toBeVisible();
  const nativeBorder=await topPlayerRow.evaluate(element=>({
    left:getComputedStyle(element).borderLeftWidth,
    right:getComputedStyle(element).borderRightWidth,
    top:getComputedStyle(element).borderTopWidth
  }));
  expect(nativeBorder).toEqual({left:'0px',right:'0px',top:'0px'});
});

test('оценка матча использует поле игроков и сохраняет единым RPC',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await page.locator('.md-primary-action').click();

  await expect(page.locator('#rateOv')).toBeVisible();
  await expect(page.locator('#rScoreDisp')).toHaveText('8/10');
  await page.locator('.rate-star').nth(8).click();
  await expect(page.locator('#rScoreDisp')).toHaveText('9/10');
  await page.getByRole('button',{name:/Продолжить/}).click();

  await expect(page.locator('.rating-squad')).toHaveCount(2);
  await expect(page.locator('.rating-player')).toHaveCount(12);
  await page.locator('#rating-player-5292').click();
  await expect(page.locator('#playerRatingName')).toHaveText('Jude Bellingham');
  await expect(page.locator('#playerRatingRange')).toHaveValue('8');
  await page.locator('#playerRatingRange').fill('9');
  await page.locator('#playerBestButton').click();
  await expect(page.locator('#rating-player-5292')).toHaveClass(/is-best/u);
  await page.getByRole('button',{name:'Готово'}).click();
  await page.locator('#rSave').click();

  await expect(page.locator('#rateOv')).toBeHidden();
  const payload=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.lastRating());
  expect(payload.p_match_rating).toBe(9);
  expect(payload.p_supporter_side).toBe('neutral');
  expect(payload.p_player_ratings).toEqual(expect.arrayContaining([
    {player_id:5290,rating:9,is_best_player:false},
    {player_id:5292,rating:9,is_best_player:true}
  ]));
});

test('дружба меняется только после успешного атомарного RPC',async({page})=>{
  await page.goto('/?__e2e=1#profile/cd291181-2db6-42cb-9f3d-ef84ab3a9660');
  const addButton=page.locator('#profAddBtn');
  await expect(addButton).toBeVisible();
  await addButton.click();
  await expect(addButton).toBeDisabled();
  await expect(addButton).toContainText('Заявка отправлена');

  await page.goto('/?__e2e=1#friends');
  await page.getByRole('button',{name:/Входящие/}).click();
  const incoming=page.locator('.friend-card').filter({hasText:'natasha'});
  await expect(incoming).toBeVisible();
  await incoming.getByRole('button',{name:/Принять/}).click();
  await expect(incoming).toHaveCount(0);

  await page.getByRole('button',{name:'Мои друзья'}).click();
  await expect(page.locator('.friend-card').filter({hasText:'natasha'})).toBeVisible();
});

test('личный чат друга сохраняет автора, время и отметку редактирования',async({page})=>{
  await page.goto('/?__e2e=1#friends');
  await page.getByRole('button',{name:/Входящие/}).click();
  const incoming=page.locator('.friend-card').filter({hasText:'natasha'});
  await incoming.getByRole('button',{name:/Принять/}).click();
  await page.getByRole('button',{name:'Мои друзья'}).click();

  const friend=page.locator('.friend-card').filter({hasText:'natasha'});
  await friend.getByRole('button',{name:/Открыть чат/}).click();
  await expect(page.locator('#directChatOv')).toHaveClass(/on/u);
  await expect(page.locator('#directChatTitle')).toHaveText('Natasha');

  await page.evaluate(()=>forwardRating(501));
  await page.locator('.dm-picker-item').filter({hasText:'natasha'}).click();
  const sharedRating=page.locator('.dm-rating-card');
  await expect(sharedRating).toContainText('10/10');
  await expect(sharedRating.locator('.dm-rating-score')).toHaveAttribute('data-tone','elite');

  await page.locator('#directChatInput').fill('Проверяем личный чат');
  await page.locator('#directChatSend').click();
  const message=page.locator('.dm-message').last();
  await expect(message).toContainText('@bazed');
  await expect(message.locator('time')).not.toBeEmpty();

  page.once('dialog',dialog=>dialog.accept('Исправленное сообщение'));
  await message.getByRole('button',{name:'Изменить'}).click();
  await expect(page.locator('.dm-message').last()).toContainText('Исправленное сообщение');
  await expect(page.locator('.dm-message').last()).toContainText('ред.');
});

test('матчи фильтруются серверным RPC без загрузки полного календаря',async({page})=>{
  await page.goto('/?__e2e=1#matches');
  await expect(page.locator('.match-results-summary')).toContainText('Показано 2 из 2');

  await page.locator('#msearch').fill('Barcelona');
  await expect(page.locator('.match-results-summary')).toContainText('Показано 1 из 1');
  await expect(page.locator('#matchG .mcard')).toContainText('FC Barcelona');

  await page.locator('#msearch').fill('');
  await page.getByRole('button',{name:'Завершённые'}).click();
  await expect(page.locator('.match-results-summary')).toContainText('Показано 1 из 1');
  await expect(page.locator('#matchG .mcard')).toContainText('Manchester City FC');
});

test('лидерборд открывает профиль с клавиатуры',async({page})=>{
  await page.goto('/?__e2e=1#leaderboard');
  const leader=page.getByRole('button',{name:/^1 место:/});
  await expect(leader).toBeVisible();
  await leader.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/profile\/cd291181-2db6-42cb-9f3d-ef84ab3a9660\?__e2e=1$/u);
  await expect(page.getByRole('heading',{name:/gamlet/i,exact:true})).toBeVisible();
});

test('восстановление пароля обрабатывает recovery-сессию и очищает токен',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.evaluate(()=>openAuth());
  await page.getByRole('button',{name:'Забыли пароль?'}).click();
  await page.locator('#recoveryEmail').fill('bazed@example.test');
  await page.getByRole('button',{name:'Отправить ссылку'}).click();
  await expect(page.getByText(/Проверьте почту/)).toBeVisible();

  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('PASSWORD_RECOVERY',window.__FOOTBAZED_TEST_AUTH__.session()));
  await expect(page.getByRole('heading',{name:'Новый пароль'})).toBeVisible();
  await page.locator('#newPassword').fill('secure-password-2026');
  await page.locator('#newPasswordConfirm').fill('secure-password-2026');
  await page.getByRole('button',{name:'Сохранить пароль'}).click();
  await expect(page.locator('#toast')).toContainText('Пароль обновлён');
  await expect(page).toHaveURL(/#home$/);
});

test('отозванная сессия немедленно возвращает гостевой интерфейс',async({page})=>{
  await page.goto('/?__e2e=1#feed');
  await expect(page.locator('#accountBtn')).toContainText('bazed');
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));
  await expect(page.locator('#accountBtn')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Войти'}).first()).toBeVisible();
});

test('уведомление открывает публикацию без таймера и гонки рендера',async({page})=>{
  await page.goto('/?__e2e=1#matches');
  const notification=page.locator('.notif-item').filter({hasText:'Gamlet оценил вашу публикацию'});
  await expect(notification).toBeAttached();
  await page.getByRole('button',{name:'Уведомления'}).click();
  await expect(page.locator('#notifPanel')).toBeVisible();
  await notification.click();
  await expect(page).toHaveURL(/\/feed\?__e2e=1$/u);
  await expect(page.locator('.feed-entry[data-rating-id="501"]')).toHaveClass(/focused/u);
});

test('avatar is normalized and stored outside the profile row',async({page})=>{
  const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYGD4z8DAwMDAxAADAA4GAQGm9k1hAAAAAElFTkSuQmCC','base64');
  await page.route('https://storage.example.test/**',route=>route.fulfill({status:200,contentType:'image/jpeg',body:pixel}));
  await page.goto('/?__e2e=1#profile/3615141a-7700-46b8-9ba5-e4f4450537fc');
  await page.locator('button[onclick="editProfile()"]').click();
  await page.locator('#avFile').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:pixel});
  await expect(page.locator('#avPreview')).toHaveAttribute('src',/^blob:/u);
  await page.locator('#epSaveBtn').click();

  await expect.poll(()=>page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.storage())).toMatchObject({
    bucket:'avatars',
    path:'3615141a-7700-46b8-9ba5-e4f4450537fc/avatar.jpg',
    type:'image/jpeg',
    options:{upsert:true,contentType:'image/jpeg',cacheControl:'31536000'}
  });
  const profile=await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.profile());
  expect(profile.avatar_url).toMatch(/^https:\/\/storage\.example\.test\/avatars\//u);
  expect(profile.avatar_url).not.toMatch(/^data:/u);
});

test.describe('мобильный авторизованный сценарий',()=>{
  test.use({viewport:{width:390,height:844}});

  test('личная лента не создаёт горизонтальную прокрутку',async({page})=>{
    await page.goto('/?__e2e=1#feed');
    await page.getByRole('button',{name:'Мои',exact:true}).click();
    await expect(page.locator('.feed-entry')).toHaveCount(1);
    await expect(page.getByText('Мои публикации')).toBeVisible();
    await expect(page.locator('.feed-edit')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('нижняя навигация открывает собственный профиль',async({page})=>{
    await page.goto('/?__e2e=1#home');
    await page.locator('#mn-profile').click();
    await expect(page).toHaveURL(/\/profile\/3615141a-7700-46b8-9ba5-e4f4450537fc\?__e2e=1$/u);
    await expect(page.getByRole('heading',{name:/bazed/i,exact:true})).toBeVisible();
  });
});
