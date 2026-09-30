(function(){
  'use strict';

  const state = {
    loaded: false,
    loading: false,
    syncing: false,
    legacyAvatars: 0,
    matches: [],
    activities: []
  };
  let apiFootballBusy=false,apiFootballConfigured=false;
  let catalogBatch=null,catalogReady=false;
  const STATUS_LABELS = {
    scheduled: 'Запланирован', live: 'LIVE', finished: 'Завершен',
    postponed: 'Перенесен', cancelled: 'Отменен'
  };
  const METRICS = [
    ['matches','Матчи','calendar'],
    ['upcoming','Предстоящие','football'],
    ['players','Игроки','users'],
    ['ratings','Оценки','star'],
    ['users','Пользователи','profile']
  ];

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  async function request(action = 'overview', body){
    const {data:{session}} = await sb.auth.getSession();
    if (!session) throw new Error('Сессия завершена. Войдите снова.');
    const response = await fetch(`/api/admin${body ? '' : `?action=${encodeURIComponent(action)}`}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? {'Content-Type':'application/json'} : {})
      },
      body: body ? JSON.stringify({action, ...body}) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const translated = ({
        400:'Проверьте параметры операции: даты, лиги и значения полей.',
        403:'У аккаунта нет доступа к админ-панели.',
        404:'Запись больше не найдена. Обновите список.',
        413:'Запрос слишком большой. Уменьшите объём операции.',
        429:'Достигнут лимит поставщика данных. Повторите проверку позже.',
        502:'Не удалось получить корректные футбольные данные. Попробуйте позже.',
        503:'Сервис администрирования временно недоступен.'
      })[response.status] || 'Не удалось выполнить операцию. Попробуйте ещё раз.';
      const providerMessages={provider_not_configured:'Секрет API-Football не настроен в этом окружении.',provider_access_denied:'API-Football отклонил доступ. Проверьте состояние ключа и подписки в кабинете поставщика.',provider_rate_limit:'Достигнут лимит API-Football. Проверьте квоту в кабинете поставщика.',provider_timeout:'API-Football не ответил вовремя. Повторите проверку позже.',provider_api_error:'API-Football не принял запрос. Проверьте доступность выбранного сезона на вашем тарифе.'};
      throw new Error(providerMessages[payload.code] || translated);
    }
    return payload;
  }

  function formatDate(value, withTime = true){
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', {
      day:'2-digit', month:'short',
      ...(withTime ? {hour:'2-digit', minute:'2-digit'} : {})
    }).format(date).replace(',', '');
  }

  function setHealth(label, status = 'ok'){
    const element = document.getElementById('adminHealth');
    if (!element) return;
    element.className = `admin-health ${status}`;
    const text = element.querySelector('span');
    if (text) text.textContent = label;
  }

  function renderMetrics(counts = {}){
    const host = document.getElementById('adminMetrics');
    if (!host) return;
    host.innerHTML = METRICS.map(([key,label,icon]) => `
      <div class="admin-metric">
        <span class="admin-metric-icon">${ico(icon,17)}</span>
        <div><b>${Number(counts[key] || 0).toLocaleString('ru-RU')}</b><small>${label}</small></div>
      </div>`).join('');
  }

  function score(match){
    return match.home_score == null || match.away_score == null
      ? '<span class="admin-score-empty">—</span>'
      : `<b>${match.home_score}</b><i>:</i><b>${match.away_score}</b>`;
  }

  function matchRow(match){
    return `<article class="admin-match-row">
      <div class="admin-match-date"><b>${formatDate(match.match_date)}</b><small>${esc(match.league_name || match.league_code || 'Лига')}</small></div>
      <div class="admin-match-teams"><span>${esc(match.home_team_name)}</span><span>${esc(match.away_team_name)}</span></div>
      <div class="admin-match-score">${score(match)}</div>
      <span class="admin-status ${esc(match.status || 'scheduled')}">${esc(STATUS_LABELS[match.status] || match.status || '—')}</span>
      <button class="admin-row-action" type="button" ${FBZActions.attrs("admin.admin-open-editor",[Number(match.id)])} aria-label="Редактировать матч" title="Редактировать">${ico('edit',15)}</button>
    </article>`;
  }

  function renderMatches(){
    const recent = document.getElementById('adminRecentMatches');
    if (recent) recent.innerHTML = state.matches.length
      ? state.matches.slice(0, 8).map(matchRow).join('')
      : '<div class="admin-empty-compact">В каталоге пока нет матчей.</div>';
    filterMatches();
  }

  function filterMatches(){
    const host = document.getElementById('adminMatchesList');
    if (!host) return;
    const query = document.getElementById('adminMatchSearch')?.value.trim().toLocaleLowerCase('ru-RU') || '';
    const rows = query ? state.matches.filter(match => [
      match.home_team_name, match.away_team_name, match.league_name, match.league_code
    ].some(value => String(value || '').toLocaleLowerCase('ru-RU').includes(query))) : state.matches;
    host.innerHTML = rows.length
      ? rows.map(matchRow).join('')
      : '<div class="admin-empty-compact">Матчи по этому запросу не найдены.</div>';
  }

  function renderActivity(){
    const host = document.getElementById('adminActivity');
    if (!host) return;
    host.innerHTML = state.activities.length ? state.activities.slice(0, 6).map(item => `
      <div><i class="${item.status || 'ok'}"></i><p>${esc(item.text)}</p><small>${esc(item.time)}</small></div>`).join('')
      : '<p>Событий пока нет.</p>';
  }

  function addActivity(text, status = 'ok'){
    state.activities.unshift({
      text,
      status,
      time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})
    });
    renderActivity();
  }

  function setApiState(configured){
    const badge = document.getElementById('adminApiState');
    const status = document.getElementById('adminFootballStatus');
    if (badge) {
      badge.textContent = configured ? 'API подключен' : 'API не настроен';
      badge.classList.toggle('ok', configured);
      badge.classList.toggle('bad', !configured);
    }
    if (status) {
      status.textContent = configured ? 'Подключен' : 'Не настроен';
      status.className = configured ? 'ok' : 'bad';
    }
  }

  function setLegacyAvatarState(value){
    state.legacyAvatars = Math.max(Number(value) || 0, 0);
    const label = document.getElementById('adminLegacyAvatarCount');
    const button = document.getElementById('adminMigrateAvatars');
    if (label) label.textContent = state.legacyAvatars
      ? `${state.legacyAvatars} профиля ожидают переноса`
      : 'Все аватары находятся в Storage';
    if (button) button.disabled = state.syncing || state.legacyAvatars === 0;
  }

  function renderProviderPanel(){
    const host=document.getElementById('admin-view-sync');
    if(!host || document.getElementById('adminApiFootballPanel'))return;
    host.insertAdjacentHTML('afterbegin',`<section class="admin-panel admin-provider-panel" id="adminApiFootballPanel" aria-labelledby="adminProviderTitle">
      <div class="admin-panel-head"><h3 id="adminProviderTitle">API-Football</h3><span id="adminProviderConfigured" class="admin-api-state">Проверяем настройки</span></div>
      <p class="admin-provider-copy">Новое подключение начинается с проверки тарифа и покрытия. Каждая проверка выполняет один запрос к поставщику.</p>
      <div class="admin-provider-actions"><button type="button" class="btn btn-l" id="adminProviderCheck" data-fbz-click="admin.provider-status" disabled>Проверить подключение</button></div>
      <div id="adminProviderAccount" class="admin-provider-result" role="status" aria-live="polite"></div>
      <form id="adminProviderForm" class="admin-provider-form" data-fbz-submit="admin.provider-competition">
        <label class="admin-edit-field"><span>Турнир</span><select name="league"><option value="PL">Premier League</option><option value="PD">La Liga</option><option value="BL1">Bundesliga</option><option value="SA">Serie A</option><option value="FL1">Ligue 1</option><option value="CL">Champions League</option></select></label>
        <label class="admin-edit-field"><span>Год начала сезона</span><input name="season" type="number" min="1990" max="${new Date().getUTCFullYear()+1}" step="1" value="${new Date().getUTCFullYear()}" required></label>
        <button type="submit" class="btn btn-g" id="adminProviderCoverageCheck" disabled>Проверить покрытие</button>
      </form>
      <div id="adminProviderCoverage" class="admin-provider-result" role="status" aria-live="polite"></div>
      <p class="admin-provider-copy">Покрытие — сведения каталога API. Доступ к матчам и составам выбранного сезона проверяется при подготовке пилота. Импорт ещё не включён.</p>
    </section>`);
  }

  function providerControls(){
    for(const id of ['adminProviderCheck','adminProviderCoverageCheck']){
      const button=document.getElementById(id);
      if(button)button.disabled=apiFootballBusy || !apiFootballConfigured;
    }
    document.getElementById('adminApiFootballPanel')?.setAttribute('aria-busy',String(apiFootballBusy));
  }

  function setProviderConfigured(configured){
    apiFootballConfigured=configured;
    const badge=document.getElementById('adminProviderConfigured');
    if(badge){badge.textContent=configured?'Секрет настроен':'Секрет не настроен';badge.className='admin-api-state '+(configured?'ok':'bad');}
    providerControls();
  }

  function quotaText(quota){
    const format=value=>value==null?'не сообщён':Number(value).toLocaleString('ru-RU');
    return `Остаток за день: ${format(quota?.dailyRemaining)} · за минуту: ${format(quota?.minuteRemaining)}`;
  }

  async function inspectProvider(kind,event){
    event?.preventDefault();
    if(apiFootballBusy || !apiFootballConfigured)return;
    const account=kind==='status',host=document.getElementById(account?'adminProviderAccount':'adminProviderCoverage');
    const form=document.getElementById('adminProviderForm');
    if(!account && !form.reportValidity())return;
    apiFootballBusy=true;providerControls();host.textContent='Проверяем API-Football…';
    try{
      const data=await request(account?'api_football_status':'api_football_competition',account?{}:{league:form.elements.league.value,season:Number(form.elements.season.value)});
      if(account){
        host.innerHTML=`<strong>${data.active?'Подключение работает':'Подписка не активна'} · ${esc(data.plan)}</strong><span>Запросов за день: ${Number(data.dailyUsed).toLocaleString('ru-RU')} из ${Number(data.dailyLimit).toLocaleString('ru-RU')}. Осталось: ${Number(data.dailyRemaining).toLocaleString('ru-RU')}.</span><span>${esc(quotaText(data.quota))}</span>`;
      }else if(!data.available){host.textContent='Для этого турнира и сезона в каталоге API нет данных. Попробуйте другой год.';}
      else{
        const flag=value=>value===true?'Есть':value===false?'Нет':'Неизвестно';
        host.innerHTML=`<strong>${esc(data.name)} · ${Number(data.season)}/${String(Number(data.season)+1).slice(-2)}</strong><dl class="admin-provider-coverage">${[['Игроки','players'],['Составы на матч','lineups'],['События','events'],['Статистика игроков','playerStatistics']].map(([label,key])=>`<div><dt>${label}</dt><dd>${flag(data.coverage?.[key])}</dd></div>`).join('')}</dl><span>${esc(quotaText(data.quota))}</span>`;
      }
    }catch(error){host.textContent=error.message;}
    finally{apiFootballBusy=false;providerControls();}
  }

  async function refresh(force = false){
    if (state.loading || (!force && state.loaded)) return;
    state.loading = true;
    setHealth('Обновляем данные', 'loading');
    try {
      const data = await request('overview');
      state.matches = data.recentMatches || [];
      state.loaded = true;
      renderMetrics(data.counts);
      renderMatches();
      setApiState(Boolean(data.footballApiConfigured));
      setProviderConfigured(Boolean(data.apiFootballConfigured));
      setLegacyAvatarState(data.counts?.legacyAvatars);
      const updated = document.getElementById('adminUpdatedAt');
      if (updated) updated.textContent = `Обновлено ${formatDate(data.checkedAt)}`;
      setHealth('База данных доступна', 'ok');
    } catch (error) {
      console.error('Admin overview error:', error);
      setHealth('Требуется внимание', 'bad');
      addActivity(error.message, 'bad');
      const host = document.getElementById('adminRecentMatches');
      if (host) host.innerHTML = `<div class="admin-error-state"><b>Не удалось загрузить админ-панель</b><span>${esc(error.message)}</span><button type="button" data-fbz-click="admin.admin-refresh">Повторить</button></div>`;
    } finally {
      state.loading = false;
    }
  }

  function mount(){
    if (!CU?.is_admin) return;
    renderProviderPanel();
    const from = document.getElementById('adminDateFrom');
    const to = document.getElementById('adminDateTo');
    if (from && !from.value) from.value = new Date().toISOString().slice(0,10);
    if (to && !to.value) {
      const end = new Date(); end.setDate(end.getDate() + 14);
      to.value = end.toISOString().slice(0,10);
    }
    refresh();
  }

  function showView(name, trigger){
    const view = document.getElementById(`admin-view-${name}`);
    if (!view) return;
    document.querySelectorAll('.admin-view').forEach(item => item.classList.remove('on'));
    document.querySelectorAll('.admin-nav-item').forEach(item => item.classList.remove('on'));
    view.classList.add('on');
    (trigger || document.querySelector(`[data-admin-view="${name}"]`))?.classList.add('on');
    if (name === 'matches') filterMatches();
  }

  function selectedLeagues(){
    return [...document.querySelectorAll('#adminLeagueGrid input:checked')].map(input => input.value);
  }

  function setSyncing(next){
    state.syncing = next;
    ['adminSyncMatches','adminSyncSquads','adminPrepareCatalog'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = next;
    });
    const avatarButton = document.getElementById('adminMigrateAvatars');
    if (avatarButton) avatarButton.disabled = next || state.legacyAvatars === 0;
    updateCleanupState();
  }

  function updateCleanupState(){
    const valid = document.getElementById('adminCleanupConfirm')?.value === 'DELETE FOOTBAZED DATA';
    document.querySelectorAll('.admin-cleanup-action').forEach(button => {
      button.disabled = state.syncing || !valid || (button.classList.contains('all')&&!catalogReady);
    });
  }

  function cleanup(scope){
    if (state.syncing) return;
    const confirmation = document.getElementById('adminCleanupConfirm')?.value || '';
    if (confirmation !== 'DELETE FOOTBAZED DATA') return toast('Введите контрольную фразу полностью','err');
    if(scope==='all'&&!catalogReady)return toast('Сначала подготовьте новый каталог','err');
    const labels = {ratings:'все оценки', players:'всех игроков', matches:'все матчи', all:'все матчи, игроков, клубы, турниры и оценки'};
    window.FBZConfirm.open({
      title:'Подтвердите очистку данных',
      message:`Будут удалены ${labels[scope] || 'выбранные данные'}. Сервер сохранит резервную копию. Аккаунты и переписки сохранятся.${scope==='all'?' Новый каталог заменит старый одной операцией.':''}`,
      confirmText:scope==='all'?'Заменить каталог':'Удалить данные',
      onConfirm:async()=>{
        setSyncing(true);
        setHealth('Удаляем тестовые данные', 'loading');
        try{
          const result = await request('cleanup_development_data', {scope, confirmation,...(scope==='all'?{batch:catalogBatch}:{})});
          const deleted = result.deleted || {};
          const summary = `Матчи: ${Number(deleted.matches || 0)}, игроки: ${Number(deleted.players || 0)}, оценки: ${Number(deleted.ratings || 0)}`;
          const host = document.getElementById('adminCleanupResult');
          if (host) host.innerHTML = `<b>${result.imported?'Каталог заменён':'Очистка завершена'}</b><span>${esc(summary)}</span>${result.imported?`<span>Загружено: ${Number(result.imported.clubs)} клубов, ${Number(result.imported.players)} игроков, ${Number(result.imported.matches)} матчей.</span>`:''}<span>Резервная копия: ${esc(result.backup_id||'—')}</span>`;
          if(scope==='all'){catalogReady=false;catalogBatch=null;}
          document.getElementById('adminCleanupConfirm').value = '';
          addActivity(`Очистка ${scope}: ${summary}`);
          toast('Выбранные данные удалены','ok');
          state.loaded = false;
          await refresh(true);
          return true;
        }catch(error){
          setHealth('Очистка не выполнена', 'bad');
          addActivity(error.message, 'bad');
          toast(error.message,'err');
          return false;
        }finally{
          setSyncing(false);
          updateCleanupState();
        }
      }
    });
  }

  async function prepareCatalog(){
    if(state.syncing)return;
    catalogReady=false;catalogBatch=crypto.randomUUID();setSyncing(true);
    const now=new Date(),start=new Date(now),end=new Date(now);start.setDate(start.getDate()-30);end.setDate(end.getDate()+14);
    const leagues=['PL','PD','BL1','SA','FL1','CL'],host=document.getElementById('adminCatalogProgress');
    try{
      for(let i=0;i<leagues.length;i++){
        host.textContent=`Подготовка ${i+1} из 6 · ${leagues[i]}. Действующий каталог остаётся доступным.`;
        const result=await request('prepare_catalog',{batch:catalogBatch,league:leagues[i],dateFrom:start.toISOString().slice(0,10),dateTo:end.toISOString().slice(0,10)});
        addActivity(`Подготовлено ${leagues[i]}: ${Number(result.matches)} матчей, ${Number(result.players)} игроков`);
        if(i<leagues.length-1){host.textContent=`Готово ${i+1} из 6. Пауза перед следующей лигой с учётом лимита API.`;await sleep(15000);}
      }
      catalogReady=true;host.textContent='Все 6 турниров подготовлены. Можно заменить каталог с резервной копией.';
    }catch(error){host.textContent='Подготовка не завершена. Старые данные сохранены. '+error.message;toast(error.message,'err');}
    finally{setSyncing(false);}
  }

  function renderTasks(leagues, mode){
    const host = document.getElementById('adminTaskList');
    if (!host) return;
    host.innerHTML = leagues.map(code => `<div class="admin-task" id="adminTask-${code}"><i></i><span>${esc(code)}</span><small>${mode === 'matches' ? 'Матчи' : 'Составы'}</small><b>Ожидает</b></div>`).join('');
  }

  function updateTask(code, status, label){
    const task = document.getElementById(`adminTask-${code}`);
    if (!task) return;
    task.className = `admin-task ${status}`;
    const value = task.querySelector('b');
    if (value) value.textContent = label;
  }

  async function sync(mode){
    if (state.syncing) return;
    const leagues = selectedLeagues();
    if (!leagues.length) return toast('Выберите хотя бы одну лигу','err');
    const dateFrom = document.getElementById('adminDateFrom')?.value;
    const dateTo = document.getElementById('adminDateTo')?.value;
    if (mode === 'matches' && (!dateFrom || !dateTo)) return toast('Выберите период загрузки','err');

    setSyncing(true);
    renderTasks(leagues, mode);
    const bar = document.getElementById('adminProgressBar');
    const total = document.getElementById('adminProgressTotal');
    if (bar) bar.style.width = '0%';
    let processed = 0;
    let failed = false;
    try {
      for (let index = 0; index < leagues.length; index += 1) {
        const league = leagues[index];
        updateTask(league, 'running', 'Загрузка');
        if (total) total.textContent = `${index + 1} из ${leagues.length}`;
        if (index > 0) await sleep(6500);
        try {
          const data = await request(mode === 'matches' ? 'sync_matches' : 'sync_squads', {
            league, dateFrom, dateTo
          });
          processed += Number(data.processed || 0);
          updateTask(league, 'done', `${Number(data.processed || 0).toLocaleString('ru-RU')} записей`);
          addActivity(`${data.leagueName}: обновлено ${data.processed} ${mode === 'matches' ? 'матчей' : 'игроков'}`);
        } catch (error) {
          failed = true;
          updateTask(league, 'failed', 'Ошибка');
          addActivity(`${league}: ${error.message}`, 'bad');
          if (/лимит/.test(error.message)) throw error;
        }
        if (bar) bar.style.width = `${Math.round(((index + 1) / leagues.length) * 100)}%`;
      }
      if (total) total.textContent = failed ? `Завершено с ошибками · ${processed}` : `Готово · ${processed} записей`;
      toast(failed ? 'Синхронизация завершена с ошибками' : 'Данные обновлены', failed ? 'err' : 'ok');
      state.loaded = false;
      await refresh(true);
    } catch (error) {
      if (total) total.textContent = error.message;
      toast(error.message, 'err');
    } finally {
      setSyncing(false);
    }
  }

  async function testConnection(){
    setHealth('Проверяем football-data.org', 'loading');
    try {
      const result = await request('test_connection', {league:selectedLeagues()[0] || 'PL'});
      setApiState(true);
      setHealth('Все системы доступны', 'ok');
      addActivity(`API отвечает: ${result.competition}`);
      toast('Подключение работает','ok');
    } catch (error) {
      setHealth('Football API недоступен', 'bad');
      addActivity(error.message, 'bad');
      toast(error.message,'err');
    }
  }

  function migrateLegacyAvatars(){
    if (state.syncing || state.legacyAvatars === 0) return;
    window.FBZConfirm.open({
      title:'Перенести аватары в Storage',
      message:`Будут безопасно перенесены ${state.legacyAvatars} legacy-аватара. Профили и изображения сохранятся.`,
      confirmText:'Начать перенос',
      tone:'neutral',
      onConfirm:async()=>{
        setSyncing(true);
        setHealth('Переносим аватары', 'loading');
        try{
          const result = await request('migrate_legacy_avatars', {});
          addActivity(`Аватары: перенесено ${result.migrated}, осталось ${result.remaining}`);
          toast(`Перенесено аватаров: ${result.migrated}`, 'ok');
          state.loaded = false;
          await refresh(true);
          return true;
        }catch(error){
          setHealth('Требуется внимание', 'bad');
          addActivity(error.message, 'bad');
          toast(error.message, 'err');
          return false;
        }finally{
          setSyncing(false);
        }
      }
    });
  }

  function openEditor(id){
    const match = state.matches.find(item => Number(item.id) === Number(id));
    if (!match) return;
    document.getElementById('adminEditMatchId').value = match.id;
    document.getElementById('adminMatchTitle').textContent = `${match.home_team_name} — ${match.away_team_name}`;
    document.getElementById('adminMatchLeague').textContent = match.league_name || match.league_code || 'Матч';
    document.getElementById('adminEditHomeName').textContent = match.home_team_name;
    document.getElementById('adminEditAwayName').textContent = match.away_team_name;
    document.getElementById('adminEditMatchStatus').value = match.status || 'scheduled';
    document.getElementById('adminEditHomeScore').value = match.home_score ?? '';
    document.getElementById('adminEditAwayScore').value = match.away_score ?? '';
    const date = new Date(match.match_date);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    document.getElementById('adminEditMatchDate').value = local;
    FBZOverlay.open('adminMatchOv','#adminEditMatchDate');
  }

  function closeEditor(){ FBZOverlay.close('adminMatchOv'); }

  async function saveMatch(event){
    event.preventDefault();
    const button = document.getElementById('adminMatchSave');
    button.disabled = true;
    button.textContent = 'Сохраняем...';
    try {
      const id = Number(document.getElementById('adminEditMatchId').value);
      const result = await request('update_match', {
        id,
        matchDate: new Date(document.getElementById('adminEditMatchDate').value).toISOString(),
        status: document.getElementById('adminEditMatchStatus').value,
        homeScore: document.getElementById('adminEditHomeScore').value,
        awayScore: document.getElementById('adminEditAwayScore').value
      });
      const index = state.matches.findIndex(match => Number(match.id) === id);
      if (index >= 0) state.matches[index] = result.match;
      renderMatches();
      addActivity(`Матч #${id} исправлен вручную`);
      closeEditor();
      toast('Матч обновлен','ok');
    } catch (error) {
      toast(error.message,'err');
    } finally {
      button.disabled = false;
      button.textContent = 'Сохранить';
    }
  }

  window.FBZAdmin = {mount, refresh:() => refresh(true), showView, filterMatches, sync, testConnection, migrateLegacyAvatars, openEditor, closeEditor, saveMatch, cleanup, updateCleanupState,prepareCatalog,inspectProvider};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "admin.provider-status":()=>FBZAdmin.inspectProvider('status'),
  "admin.provider-competition":event=>FBZAdmin.inspectProvider('competition',event),
  "admin.admin-open-editor":(event,element,[id])=>FBZAdmin.openEditor(id),
  "admin.admin-refresh":()=>FBZAdmin.refresh(true)
});
