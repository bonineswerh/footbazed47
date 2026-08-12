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
      const translated = response.status === 429
        ? 'Достигнут лимит football-data.org. Подождите минуту и продолжите.'
        : response.status === 403
          ? 'У аккаунта нет доступа к админ-панели.'
          : payload.error || 'Не удалось выполнить операцию.';
      throw new Error(translated);
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
      <button class="admin-row-action" type="button" onclick="FBZAdmin.openEditor(${Number(match.id)})" aria-label="Редактировать матч" title="Редактировать">${ico('edit',15)}</button>
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
      setLegacyAvatarState(data.counts?.legacyAvatars);
      const updated = document.getElementById('adminUpdatedAt');
      if (updated) updated.textContent = `Обновлено ${formatDate(data.checkedAt)}`;
      setHealth('Все системы доступны', 'ok');
    } catch (error) {
      console.error('Admin overview error:', error);
      setHealth('Требуется внимание', 'bad');
      addActivity(error.message, 'bad');
      const host = document.getElementById('adminRecentMatches');
      if (host) host.innerHTML = `<div class="admin-error-state"><b>Не удалось загрузить админ-панель</b><span>${esc(error.message)}</span><button type="button" onclick="FBZAdmin.refresh(true)">Повторить</button></div>`;
    } finally {
      state.loading = false;
    }
  }

  function mount(){
    if (!CU?.is_admin) return;
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
    ['adminSyncMatches','adminSyncSquads'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = next;
    });
    const avatarButton = document.getElementById('adminMigrateAvatars');
    if (avatarButton) avatarButton.disabled = next || state.legacyAvatars === 0;
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

  window.FBZAdmin = {mount, refresh:() => refresh(true), showView, filterMatches, sync, testConnection, migrateLegacyAvatars, openEditor, closeEditor, saveMatch};
})();
