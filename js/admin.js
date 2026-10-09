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
  let emblemBatch=null,emblemApplied=false,missingEmblemId=null;
  let lineupBatch=null;
  let catalogBatch=null,catalogReady=false;
  const audit={items:[],nextCursor:null,hasMore:false,busy:false,version:0};
  let apiCheck=null;
  const reports={version:0,offset:0,total:0,hasMore:false,status:'open',type:'all',items:[],busy:false};
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
    const user=CU?.id;
    const {data:{session}} = await sb.auth.getSession();
    if (!session||user!==CU?.id) throw new Error('Сессия завершена. Войдите снова.');
    const response = await fetch(`/api/admin${body ? '' : `?action=${encodeURIComponent(action)}`}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? {'Content-Type':'application/json'} : {})
      },
      body: body ? JSON.stringify({action, ...body}) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if(user!==CU?.id)throw new Error('Сессия завершена. Войдите снова.');
    if (!response.ok) {
      if(['admin_mfa_required','admin_mfa_recent_required','admin_session_invalid'].includes(payload.code)){
        if(action!=='access_status')window.FBZAdminSecurity?.required(payload.code);
        throw Object.assign(new Error(payload.code==='admin_session_invalid'?'Сессия завершена. Войдите снова.':'Подтвердите защиту администратора и повторите действие.'),{code:payload.code});
      }
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
      providerMessages.provider_plan_restricted='Текущий тариф API-Football не предоставляет эти данные. Выберите доступный сезон или проверьте покрытие в кабинете поставщика. Это ограничение тарифа, а не ошибка ключа.';
      providerMessages.provider_pagination_limit='Поиск дал слишком много команд. Импорт остановлен: требуется более точное название клуба.';
      Object.assign(providerMessages,{fixture_identity_not_found:'В API-Football нет однозначного совпадения с этой игрой. Состав не импортирован.',fixture_identity_ambiguous:'Найдено несколько похожих игр. Импорт остановлен до проверки идентификаторов.',fixture_club_mapping_missing:'Сначала сопоставьте обе команды с каталогом API-Football.',provider_lineups_unavailable:'Поставщик пока не отдаёт состав этого матча.',lineup_already_imported:'Исторический состав уже сохранён для этого матча.'});
      throw new Error(providerMessages[payload.code] || translated);
    }
    return payload;
  }

  function formatDate(value, withTime = true){
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(window.FBZLocale?.intl || 'ru-RU', {
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

  const auditLabels={sync_matches:'Импорт матчей',sync_squads:'Каталог игроков',sync_matches_failed:'Ошибка импорта матчей',sync_squads_failed:'Ошибка импорта игроков',test_connection:'Проверка football-data.org',update_match:'Ручное изменение матча',apply_club_emblems:'Публикация эмблем',apply_match_lineup:'Публикация состава',prepare_catalog:'Подготовка каталога',cleanup_development_data:'Очистка тестовых данных',migrate_legacy_avatars:'Перенос аватаров',other:'Административная операция'};
  function auditText(item){
    return (auditLabels[item.action] || auditLabels.other)+(item.league?' · '+item.league:'')+(Number.isSafeInteger(item.processed)?' · '+item.processed+' записей':'');
  }
  function renderAudit(){
    const panel=document.getElementById('adminAuditPanel');if(!panel)return;
    panel.hidden=false;
    document.getElementById('adminAuditList').innerHTML=audit.items.length?audit.items.map(item=>`<div class="admin-audit-row${item.failed?' failed':''}"><span>${ico(item.failed?'shield':'check',16)}</span><div><strong>${esc(auditText(item))}</strong>${item.dateFrom&&item.dateTo?`<small>${esc(item.dateFrom)} — ${esc(item.dateTo)} · UTC</small>`:''}</div><time datetime="${esc(item.at)}">${esc(formatDate(item.at))}</time></div>`).join(''):'<p class="admin-empty-compact">Операций пока нет.</p>';
    const more=document.getElementById('adminAuditMore');more.hidden=!audit.hasMore;more.disabled=audit.busy;
    more.textContent=audit.busy?'Загружаем…':'Ещё операции';
  }
  async function moreAudit(){
    if(audit.busy||!audit.hasMore||!audit.nextCursor)return;
    const user=CU?.id,route=routeVersion,version=audit.version;
    audit.busy=true;renderAudit();
    try{
      const data=await request('audit_history',{before_id:audit.nextCursor});
      if(user!==CU?.id||!CU?.is_admin||CP!=='admin'||route!==routeVersion||version!==audit.version)return;
      const seen=new Set(audit.items.map(item=>item.id));
      audit.items.push(...(data.items||[]).filter(item=>!seen.has(item.id)));
      audit.hasMore=Boolean(data.hasMore);audit.nextCursor=data.nextCursor;
    }catch(error){if(user===CU?.id&&CP==='admin')toast('Не удалось загрузить журнал. '+error.message,'err');}
    finally{audit.busy=false;if(user===CU?.id&&CP==='admin')renderAudit();}
  }
  function renderFreshness(data){
    const host=document.getElementById('adminFreshness');if(!host||!data)return;
    host.hidden=false;
    const last=data.latestImport;
    host.innerHTML=`<div class="admin-panel-head"><h3>Актуальность данных</h3><span>Обновление запускается вручную</span></div><div class="admin-freshness-grid"><div><small>Последний импорт матчей</small><strong>${last?esc(formatDate(last.at)):'Ещё не зафиксирован'}</strong><span>${last?esc(last.league||'')+(last.dateFrom?' · '+esc(last.dateFrom)+' — '+esc(last.dateTo):' · период не записан'):''}</span></div><div><small>Последний завершённый матч</small><strong>${data.latestFinishedAt?esc(formatDate(data.latestFinishedAt)):'Нет данных'}</strong><span>Дата игры, не время импорта</span></div><div><small>Ближайший матч</small><strong>${data.nextMatchAt?esc(formatDate(data.nextMatchAt)):'В календаре нет'}</strong><span>По сохранённому календарю</span></div><div><small>Подтверждённые составы</small><strong>${Number(data.confirmedLineups)||0}</strong><span>Историческое участие игроков</span></div></div>${Number(data.overdueMatches)>0?`<p class="admin-freshness-warning">Проверьте статусы: ${Number(data.overdueMatches)} матчей начались более 6 часов назад и ещё не завершены в базе.</p>`:''}`;
  }

  function setApiState(configured, checked){
    if(checked)apiCheck={state:checked,at:Date.now()};
    const verified=configured&&apiCheck&&Date.now()-apiCheck.at<5*60*1000?apiCheck.state:null;
    const badge = document.getElementById('adminApiState');
    const status = document.getElementById('adminFootballStatus');
    if (badge) {
      badge.textContent = !configured?'API не настроен':verified==='ok'?'API отвечает':verified==='bad'?'Ошибка проверки':'Ключ настроен · API не проверен';
      badge.classList.toggle('ok', verified==='ok');
      badge.classList.toggle('bad', !configured||verified==='bad');
    }
    if (status) {
      status.textContent = !configured?'Не настроен':verified==='ok'?'Отвечает':verified==='bad'?'Проверка не прошла':'Не проверен';
      status.className = verified==='ok'?'ok':!configured||verified==='bad'?'bad':'';
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
      <p class="admin-provider-copy">Доступ к составам зависит от турнира, сезона и тарифа поставщика.</p>
      <div class="admin-emblem-section">
        <h4>Эмблемы клубов</h4>
        <p class="admin-provider-copy">Подготовьте эмблемы для турнира и сезона, выбранных выше. Один запрос к API. Публикация сохраняет существующие клубы, матчи и оценки. Неоднозначные совпадения пропускаются.</p>
        <div class="admin-provider-form admin-missing-emblem"><label class="admin-edit-field"><span>Клуб без эмблемы</span><select id="adminMissingEmblemClub" data-fbz-change="admin.emblems-reset"><option value="">Загрузка каталога…</option></select></label><button type="button" class="btn btn-g" id="adminMissingEmblemPrepare" data-fbz-click="admin.emblems-missing" disabled>Найти эмблему клуба</button></div>
        <p class="admin-provider-copy">Точечный поиск не зависит от сезона. Один запрос, проверка названия, страны и доступного года основания; несколько подходящих клубов не подключаются автоматически.</p>
        <div class="admin-provider-actions"><button type="button" class="btn btn-g" id="adminEmblemsPrepare" data-fbz-click="admin.emblems-prepare" disabled>Подготовить эмблемы</button><button type="button" class="btn btn-l" id="adminEmblemsApply" data-fbz-click="admin.emblems-apply" disabled>Опубликовать эмблемы</button><button type="button" class="btn btn-g" id="adminEmblemsUndo" data-fbz-click="admin.emblems-undo" hidden>Отменить подключение</button></div>
        <div id="adminEmblemsResult" class="admin-provider-result" role="status" aria-live="polite"></div>
        <div id="adminEmblemsPreview" class="admin-emblem-grid" aria-label="Подготовленные эмблемы"></div>
        <p class="admin-provider-copy">Эмблемы используются для обозначения клубов. Источник — API-Football / API-Sports; подтверждённая лицензия не заявляется. <a href="https://www.api-football.com/terms" target="_blank" rel="noopener noreferrer">Условия источника</a></p>
      </div>
      <div class="admin-emblem-section">
        <h4>Исторический состав матча</h4>
        <p class="admin-provider-copy">Стартовые 11, вышедшие на замену, минуты и события этой игры. Подготовка выполняет до четырёх запросов. Состав клуба не используется вместо состава матча.</p>
        <form id="adminLineupForm" class="admin-provider-form" data-fbz-submit="admin.lineup-prepare">
          <label class="admin-edit-field"><span>Завершённый матч</span><select name="match_id" id="adminLineupMatch" data-fbz-change="admin.lineup-reset" required><option value="">Выберите матч</option></select></label>
          <button type="submit" class="btn btn-g" id="adminLineupPrepare" disabled>Подготовить состав</button>
          <button type="button" class="btn btn-l" id="adminLineupApply" data-fbz-click="admin.lineup-apply" disabled>Опубликовать состав</button>
        </form>
        <div id="adminLineupResult" class="admin-provider-result" role="status" aria-live="polite"></div>
        <div id="adminLineupPreview" class="admin-lineup-preview"></div>
      </div>
    </section>`);
  }

  function providerControls(){
    for(const id of ['adminProviderCheck','adminProviderCoverageCheck','adminEmblemsPrepare','adminLineupPrepare']){
      const button=document.getElementById(id);
      if(button)button.disabled=apiFootballBusy || !apiFootballConfigured;
    }
    const apply=document.getElementById('adminEmblemsApply'),undo=document.getElementById('adminEmblemsUndo');
    if(apply)apply.disabled=apiFootballBusy||!emblemBatch||emblemApplied;
    if(undo){undo.hidden=!emblemApplied;undo.disabled=apiFootballBusy;}
    const lineupApply=document.getElementById('adminLineupApply');
    if(lineupApply)lineupApply.disabled=apiFootballBusy||!lineupBatch;
    const lineupMatch=document.getElementById('adminLineupMatch');
    if(lineupMatch)lineupMatch.disabled=apiFootballBusy;
    const missingSelect=document.getElementById('adminMissingEmblemClub'),missingPrepare=document.getElementById('adminMissingEmblemPrepare');
    if(missingSelect)missingSelect.disabled=apiFootballBusy;
    if(missingPrepare)missingPrepare.disabled=apiFootballBusy||!apiFootballConfigured||!missingSelect?.value;
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

  async function matchLineup(kind,event){
    event?.preventDefault();
    if(apiFootballBusy||!apiFootballConfigured)return;
    const result=document.getElementById('adminLineupResult'),preview=document.getElementById('adminLineupPreview');
    const matchId=Number(document.getElementById('adminLineupMatch').value);
    if(kind==='prepare'&&(!Number.isSafeInteger(matchId)||matchId<1))return;
    apiFootballBusy=true;providerControls();
    try{
      if(kind==='prepare'){
        lineupBatch=null;preview.replaceChildren();result.textContent='Проверяем совпадение матча и получаем его состав…';
        const data=await request('prepare_match_lineup',{match_id:matchId}),p=data.preview;
        lineupBatch=data.batch||null;
        const participants=p.players.filter(item=>item.participation!=='bench'),linked=participants.filter(item=>item.player_id!=null).length;
        result.textContent=`Подтверждено участников: ${participants.length}. Сопоставлено профилей: ${linked}. ${quotaText(data.quota)}`;
        preview.innerHTML=`<p>Схемы: ${esc(p.home_formation||'нет данных')} / ${esc(p.away_formation||'нет данных')}</p><ul>${participants.map(item=>`<li><span>${esc(item.name)}</span><small>${item.participation==='starter'?'Старт':'Замена'} · ${item.minutes_played==null?'Минуты неизвестны':Number(item.minutes_played)+' мин'}${item.player_id==null?' · Профиль не сопоставлен':''}</small></li>`).join('')}</ul>`;
      }else if(lineupBatch){
        result.textContent='Сохраняем исторический состав…';
        const data=await request('apply_match_lineup',{batch:lineupBatch});
        lineupBatch=null;result.textContent=`Состав матча #${Number(data.match_id)} опубликован. Ранее сохранённые оценки остались на месте.`;
      }
    }catch(error){result.textContent=error.message;}
    finally{apiFootballBusy=false;providerControls();}
  }

  function resetLineup(){lineupBatch=null;document.getElementById('adminLineupPreview')?.replaceChildren();const result=document.getElementById('adminLineupResult');if(result)result.textContent='';providerControls();}

  async function clubEmblems(kind){
    if(apiFootballBusy||!apiFootballConfigured)return;
    const result=document.getElementById('adminEmblemsResult');
    apiFootballBusy=true;providerControls();
    try{
      if(kind==='prepare'||kind==='missing'){
        const clubId=Number(document.getElementById('adminMissingEmblemClub').value);
        if(kind==='missing'&&(!Number.isSafeInteger(clubId)||clubId<1))return;
        emblemBatch=null;emblemApplied=false;missingEmblemId=kind==='missing'?clubId:null;document.getElementById('adminEmblemsPreview').replaceChildren();
        result.textContent='Получаем эмблемы и проверяем совпадения клубов…';
        const form=document.getElementById('adminProviderForm');
        const data=await request(kind==='missing'?'prepare_missing_club_emblem':'prepare_club_emblems',kind==='missing'?{club_id:clubId}:{league:form.elements.league.value,season:Number(form.elements.season.value)});
        emblemBatch=data.batch||null;
        const items=Array.isArray(data.items)?data.items:[];
        result.textContent=`${kind==='missing'?'Поиск «'+data.query+'»':data.league+' · '+data.season+'/'+String(Number(data.season)+1).slice(-2)}: подготовлено ${items.length} из ${Number(data.received)||0}. Пропущено: ${Array.isArray(data.skipped)?data.skipped.length:0}. ${quotaText(data.quota)}`;
        const skipped=Array.isArray(data.skipped)?data.skipped:[];
        const reasons={no_match:'нет точного совпадения названия и страны',ambiguous:'несколько похожих клубов',mapping_conflict:'конфликт идентификаторов',not_club:'сборная или неизвестный тип команды',identity_conflict:'год основания не совпал'};
        document.getElementById('adminEmblemsPreview').innerHTML=items.map(item=>`<div>${FBZMedia.visual({entity:{name:item.club_name,media:{asset_type:'club_logo',usage_status:'identification',source_provider:'api-football',url:item.source_url}},kind:'club',className:'admin-emblem-mark'})}<span>${esc(item.club_name)}${kind==='missing'?`<small>${esc(item.provider_name)} · ${esc(item.country)}</small>`:''}${item.identity_evidence?`<small>Исторические даты: ${Number(item.identity_evidence.local_founded)} / ${Number(item.identity_evidence.provider_founded)}</small>`:''}</span></div>`).join('')+(skipped.length?`<details class="admin-emblem-skipped"><summary>Пропущенные клубы: ${skipped.length}</summary><ul>${skipped.map(item=>`<li>${esc(item.providerName)}${item.country?' · '+esc(item.country):''} — ${esc(reasons[item.reason]||'не подключён')}${item.reason==='identity_conflict'?` (каталог: ${Number(item.localFounded)}; поставщик: ${Number(item.providerFounded)})`:''}</li>`).join('')}</ul></details>`:'');
      }else{
        if(!emblemBatch)return;
        result.textContent=kind==='apply'?'Подключаем эмблемы…':'Восстанавливаем предыдущие эмблемы…';
        const data=await request(kind==='apply'?'apply_club_emblems':'rollback_club_emblems',{batch:emblemBatch});
        emblemApplied=kind==='apply';
        if(emblemApplied&&missingEmblemId){document.querySelector(`#adminMissingEmblemClub option[value="${missingEmblemId}"]`)?.remove();document.getElementById('adminMissingEmblemClub').value='';}
        result.textContent=emblemApplied?`Подключено эмблем: ${Number(data.applied)||0}. Они доступны в календаре, ленте и на страницах клубов.`:`Восстановлено клубов: ${Number(data.restored)||0}.`;
        if(!emblemApplied)emblemBatch=null;
        FBZData.invalidate();clearAppCache();
        addActivity(result.textContent);
      }
    }catch(error){result.textContent=error.message;}
    finally{apiFootballBusy=false;providerControls();}
  }

  function resetEmblems(){emblemBatch=null;emblemApplied=false;missingEmblemId=null;document.getElementById('adminEmblemsPreview')?.replaceChildren();const result=document.getElementById('adminEmblemsResult');if(result)result.textContent='';providerControls();}

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
    const user=CU?.id,route=routeVersion;
    setHealth('Обновляем данные', 'loading');
    try {
      const data = await request('overview');
      if(user!==CU?.id||!CU?.is_admin||CP!=='admin'||route!==routeVersion)return;
      state.matches = data.recentMatches || [];
      const lineupSelect=document.getElementById('adminLineupMatch');
      const missingSelect=document.getElementById('adminMissingEmblemClub');
      if(missingSelect)missingSelect.innerHTML='<option value="">Выберите клуб</option>'+(data.missingEmblemClubs||[]).map(c=>`<option value="${Number(c.id)}">${esc(c.name)} · ${esc(c.area_name||'Страна неизвестна')}</option>`).join('');
      if(lineupSelect)lineupSelect.innerHTML='<option value="">Выберите матч</option>'+state.matches.filter(m=>m.status==='finished').map(m=>`<option value="${Number(m.id)}">${esc(m.home_team_name)} — ${esc(m.away_team_name)} · ${esc(new Date(m.match_date).toLocaleDateString('ru-RU'))}</option>`).join('');
      state.loaded = true;
      renderMetrics(data.counts);
      renderMatches();
      setApiState(Boolean(data.footballApiConfigured));
      setProviderConfigured(Boolean(data.apiFootballConfigured));
      setLegacyAvatarState(data.counts?.legacyAvatars);
      renderFreshness(data.freshness);
      if(data.activity){
        audit.version++;audit.items=data.activity.items||[];audit.hasMore=Boolean(data.activity.hasMore);audit.nextCursor=data.activity.nextCursor;renderAudit();
        state.activities=audit.items.slice(0,6).map(item=>({text:auditText(item),status:item.failed?'bad':'ok',time:formatDate(item.at)}));renderActivity();
      }
      const updated = document.getElementById('adminUpdatedAt');
      if (updated) updated.textContent = `Проверено ${formatDate(data.checkedAt)}`;
      setHealth('База данных доступна', 'ok');
    } catch (error) {
      if(user!==CU?.id||CP!=='admin'||route!==routeVersion)return;
      console.error('Admin overview error:', error);
      setHealth('Требуется внимание', 'bad');
      addActivity(error.message, 'bad');
      const host = document.getElementById('adminRecentMatches');
      if (host) host.innerHTML = `<div class="admin-error-state"><b>Не удалось загрузить админ-панель</b><span>${esc(error.message)}</span><button type="button" data-fbz-click="admin.admin-refresh">Повторить</button></div>`;
    } finally {
      state.loading = false;
    }
  }

  async function mount(){
    if (!CU?.is_admin) return;
    const console=document.getElementById('adminConsole');if(console){console.hidden=true;console.inert=true;}
    const user=CU.id,route=routeVersion;
    try{
      const security=await FBZFeatures.load({key:'adminSecurity',script:'js/admin-security.js?v=20261009-admin-mfa-qr1',ready:()=>window.FBZAdminSecurity});
      if(user!==CU?.id||CP!=='admin'||route!==routeVersion||!await security.mount())return;
    }catch{
      if(user===CU?.id&&CP==='admin'){
        document.getElementById('adminSecurityGate')?.remove();
        console?.insertAdjacentHTML('beforebegin','<section class="admin-security-gate" id="adminSecurityGate"><h1>Защита администратора</h1><p>Не удалось загрузить защиту администратора. Повторите вход в раздел.</p><button type="button" class="btn btn-l admin-security-primary" data-fbz-click="admin.security-retry">Повторить</button></section>');
      }return;
    }
    renderProviderPanel();
    if(!document.querySelector('[data-admin-view="experts"]'))document.querySelector('.admin-nav')?.insertAdjacentHTML('beforeend','<button class="admin-nav-item" type="button" data-admin-view="experts" data-fbz-click="admin.experts-open">'+ico('shield',17)+'<span>Эксперты</span></button>');
    if(!document.querySelector('[data-admin-view="help"]'))document.querySelector('.admin-nav')?.insertAdjacentHTML('beforeend','<button class="admin-nav-item" type="button" data-admin-view="help" data-fbz-click="admin.help-open">'+ico('info',17)+'<span>Инструкция</span></button>');
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
    reports.version++;
    if (name === 'reports') loadReportQueue();
  }

  const reportReasons={harassment:'Оскорбления или травля',hate:'Разжигание ненависти',spam:'Спам или реклама',impersonation:'Выдаёт себя за другого',other:'Другая причина'};
  const reportStatuses={open:'Ожидает решения',reviewed:'Рассмотрена',dismissed:'Отклонена'};
  const reportTypes={rating:'Запись',comment:'Комментарий',profile:'Профиль'};
  function mountReports(){
    if(document.getElementById('admin-view-reports'))return;
    const nav=document.querySelector('.admin-nav'),workspace=document.querySelector('.admin-workspace');if(!nav||!workspace)return;
    nav.insertAdjacentHTML('beforeend','<button class="admin-nav-item" type="button" data-admin-view="reports" data-fbz-click="admin.reports-open">'+ico('shield',17)+'<span>Жалобы</span></button>');
    workspace.insertAdjacentHTML('beforeend','<section class="admin-view" id="admin-view-reports" aria-labelledby="adminReportsTitle"><div class="admin-section-head"><div><h2 id="adminReportsTitle">Жалобы сообщества</h2><p>Проверьте обращение и оставьте причину решения. Старые оценки сохраняются.</p></div></div>'
      +'<div class="admin-report-counts" id="adminReportCounts" aria-label="Статусы жалоб"></div>'
      +'<form class="admin-report-filters" id="adminReportFilters"><div><label for="adminReportStatus">Статус</label><select class="input" id="adminReportStatus" name="status"><option value="open">Ожидают решения</option><option value="reviewed">Рассмотрены</option><option value="dismissed">Отклонены</option><option value="all">Все обращения</option></select></div><div><label for="adminReportType">Тип</label><select class="input" id="adminReportType" name="type"><option value="all">Все типы</option><option value="rating">Записи</option><option value="comment">Комментарии</option><option value="profile">Профили</option></select></div><button class="btn btn-g" type="button" data-fbz-click="admin.reports-retry">Обновить</button></form>'
      +'<p class="admin-report-note">«Рассмотрена» фиксирует проверку обращения. Это действие не удаляет запись и не ограничивает аккаунт автоматически.</p>'
      +'<div id="adminReportList" class="admin-report-list" aria-live="polite" aria-busy="false"></div><div class="admin-report-pagination"><span id="adminReportPage" role="status"></span><div><button class="btn btn-g btn-sm" type="button" id="adminReportPrevious" data-fbz-click="admin.reports-previous">Назад</button><button class="btn btn-g btn-sm" type="button" id="adminReportNext" data-fbz-click="admin.reports-next">Далее →</button></div></div></section>');
    const form=document.getElementById('adminReportFilters');form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('change',()=>{reports.status=form.elements.status.value;reports.type=form.elements.type.value;reports.offset=0;loadReportQueue();});
  }
  function reportCurrent(version,user,route){return version===reports.version&&user===CU?.id&&CU?.is_admin&&route===routeVersion&&CP==='admin'&&document.getElementById('admin-view-reports')?.classList.contains('on');}
  function reportControls(){
    const previous=document.getElementById('adminReportPrevious'),next=document.getElementById('adminReportNext');
    if(previous)previous.disabled=reports.busy||reports.offset===0;if(next)next.disabled=reports.busy||!reports.hasMore;
    document.querySelectorAll('#adminReportFilters input,#adminReportFilters select,#adminReportFilters button').forEach(el=>{el.disabled=reports.busy;});
  }
  function reportRow(r){
    const id=String(r.id),snapshot=r.snapshot||{};
    return '<article class="admin-report-card" data-report-id="'+esc(id)+'"><header><div><span class="section-kicker">'+esc(reportTypes[r.target_type]||'Обращение')+'</span><h3>'+esc(snapshot.label||'Запись больше не найдена')+'</h3><p>@'+esc(snapshot.username||'удалённый аккаунт')+' · '+esc(reportReasons[r.reason]||'Другая причина')+'</p></div><span class="admin-report-status">'+esc(reportStatuses[r.status]||r.status)+'</span></header>'
      +'<p class="admin-report-meta">Отправил '+(r.reporter?.username?'@'+esc(r.reporter.username):'удалённый аккаунт')+' · '+esc(formatDate(r.created_at))+'</p>'
      +(r.details?'<p class="admin-report-details">'+esc(r.details)+'</p>':'')+'<details><summary>Текст на момент обращения</summary><blockquote>'+esc(snapshot.text||'Текст отсутствует')+'</blockquote></details>'
      +(r.subject_id?'<button class="admin-text-button" type="button" '+FBZActions.attrs('app.go-profile',[r.subject_id])+'>Открыть профиль автора →</button>':'')
      +(r.status==='open'?'<form class="admin-report-decision" '+FBZActions.attrs('admin.report-review',[id],'submit')+'><label for="report-note-'+esc(id)+'">Причина решения</label><textarea class="input" id="report-note-'+esc(id)+'" name="note" rows="2" minlength="10" maxlength="1000" required aria-describedby="report-note-help-'+esc(id)+'"></textarea><small id="report-note-help-'+esc(id)+'">10–1000 символов. Эту причину увидит отправитель жалобы.</small><div><label for="report-decision-'+esc(id)+'" class="sr-only">Решение по обращению</label><select class="input" id="report-decision-'+esc(id)+'" name="decision"><option value="reviewed">Рассмотрена</option><option value="dismissed">Отклонена</option></select><button class="btn btn-l" type="submit">Сохранить решение</button></div><p role="status" class="admin-report-result"></p></form>':'<p class="admin-report-decision-note">'+esc(r.decision_note||'')+'</p>')+'</article>';
  }
  async function loadReportQueue(){
    if(!CU?.is_admin||CP!=='admin')return;
    const version=++reports.version,user=CU.id,route=routeVersion,host=document.getElementById('adminReportList');if(!host)return;
    reports.busy=true;reportControls();host.setAttribute('aria-busy','true');host.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка жалоб</span></div>';document.getElementById('adminReportPage').textContent='';
    try{
      const data=await request('moderation_queue',{status:reports.status,target_type:reports.type,offset:reports.offset});
      if(!reportCurrent(version,user,route))return;
      reports.items=Array.isArray(data.items)?data.items:[];reports.total=Number(data.total)||0;reports.hasMore=Boolean(data.has_more);
      if(!reports.items.length&&reports.offset>0&&reports.total<=reports.offset){reports.offset=Math.max(0,Math.floor((Math.max(1,reports.total)-1)/20)*20);return loadReportQueue();}
      document.getElementById('adminReportCounts').innerHTML=Object.entries(reportStatuses).map(([key,label])=>'<div><strong>'+Number(data.counts?.[key]||0)+'</strong><span>'+esc(label)+'</span></div>').join('');
      host.innerHTML=reports.items.length?reports.items.map(reportRow).join(''):'<div class="admin-empty-compact"><strong>Обращений по этим фильтрам нет</strong><p>Новые жалобы появятся здесь. Можно выбрать другой статус или тип.</p></div>';
      document.getElementById('adminReportPage').textContent=reports.items.length?(reports.offset+1)+'–'+(reports.offset+reports.items.length)+' из '+reports.total:'Нет обращений';
    }catch(error){if(reportCurrent(version,user,route)){host.innerHTML='<div class="admin-error-state"><b>Не удалось загрузить жалобы</b><span>'+esc(error.message)+'</span><button class="btn btn-g" type="button" data-fbz-click="admin.reports-retry">Повторить</button></div>';reports.hasMore=false;}}
    finally{if(reportCurrent(version,user,route)){reports.busy=false;host.setAttribute('aria-busy','false');reportControls();}}
  }
  function reportPage(direction){if(reports.busy)return;if(direction>0&&reports.hasMore)reports.offset+=20;else if(direction<0&&reports.offset>0)reports.offset=Math.max(0,reports.offset-20);else return;loadReportQueue();document.getElementById('adminReportsTitle')?.scrollIntoView({block:'start',behavior:'instant'});}
  async function reviewReport(event,id){
    event.preventDefault();const form=event.target;
    if(reports.busy||!CU?.is_admin||!form.reportValidity()||!reports.items.some(r=>r.id===id&&r.status==='open'))return;
    const version=reports.version,user=CU.id,route=routeVersion;
    reports.busy=true;reportControls();document.querySelectorAll('.admin-report-decision button').forEach(el=>{el.disabled=true;});
    const result=form.querySelector('[role="status"]');result.textContent='Сохраняем решение…';
    try{
      const data=await request('review_community_report',{report_id:id,status:form.elements.decision.value,note:form.elements.note.value.trim()});
      if(!reportCurrent(version,user,route))return;
      toast(data.already_reviewed?'Обращение уже рассмотрено. Список обновлён.':'Решение сохранено в журнале.','ok');await loadReportQueue();
    }catch(error){if(reportCurrent(version,user,route))result.textContent=error.message;}
    finally{if(reportCurrent(version,user,route)){reports.busy=false;reportControls();document.querySelectorAll('.admin-report-decision button').forEach(el=>{el.disabled=false;});}}
  }
  window.addEventListener('fbz:session-change',()=>{reports.version++;reports.busy=false;reports.items=[];reports.offset=0;document.getElementById('adminReportList')?.replaceChildren();document.getElementById('adminReportCounts')?.replaceChildren();const page=document.getElementById('adminReportPage');if(page)page.textContent='';});
  mountReports();

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
          if(data.auditRecorded===false)toast('Данные сохранены, но запись в журнал не удалась. Не запускайте импорт повторно только из-за журнала.','err');
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
      setApiState(true,'ok');
      setHealth('football-data.org отвечает', 'ok');
      addActivity(`API отвечает: ${result.competition}`);
      toast('Подключение работает','ok');
    } catch (error) {
      setHealth('Football API недоступен', 'bad');
      setApiState(true,'bad');
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

  function resetSession(){state.loaded=false;state.matches=[];state.activities=[];audit.version++;audit.items=[];reports.version++;reports.items=[];emblemBatch=null;lineupBatch=null;catalogBatch=null;catalogReady=false;}
  window.FBZAdmin = {request,mount,resetSession, refresh:() => refresh(true), showView, filterMatches, sync, testConnection, migrateLegacyAvatars, openEditor, closeEditor, saveMatch, cleanup, updateCleanupState,prepareCatalog,inspectProvider,clubEmblems,matchLineup,resetLineup,resetEmblems,loadReportQueue,reportPage,reviewReport,moreAudit};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "admin.security-retry":()=>FBZAdmin.mount(),
  "admin.audit-more":()=>FBZAdmin.moreAudit(),
  "admin.audit-open":(event,element)=>FBZAdmin.showView('audit',element),
  "admin.experts-open":async(event,element)=>{
    const user=CU?.id,route=routeVersion;
    try{await FBZFeatures.load({key:'adminExperts',script:'js/admin-experts.js?v=20261007-community',ready:()=>window.FBZAdminExperts});
      if(CU?.is_admin&&user===CU.id&&route===routeVersion&&CP==='admin'){FBZAdminExperts.mount();FBZAdmin.showView('experts',element);FBZAdminExperts.load();}
    }catch{if(user===CU?.id&&CP==='admin')toast('Не удалось открыть экспертов','err');}
  },
  "admin.help-open":async(event,element)=>{
    const user=CU?.id,version=routeVersion;
    try{
      await FBZFeatures.load({key:'adminGuide',script:'js/admin-guide.js?v=20261008-admin-mfa',ready:()=>window.FBZAdminGuide});
      if(CU?.id===user&&CU?.is_admin&&CP==='admin'&&routeVersion===version){FBZAdminGuide.mount();FBZAdmin.showView('help',element);}
    }catch{if(CU?.id===user&&CP==='admin')toast('Не удалось открыть инструкцию','err');}
  },
  "admin.reports-open":(event,element)=>FBZAdmin.showView('reports',element),
  "admin.reports-retry":()=>FBZAdmin.loadReportQueue(),
  "admin.reports-previous":()=>FBZAdmin.reportPage(-1),
  "admin.reports-next":()=>FBZAdmin.reportPage(1),
  "admin.report-review":(event,element,[id])=>FBZAdmin.reviewReport(event,id),
  "admin.provider-status":()=>FBZAdmin.inspectProvider('status'),
  "admin.provider-competition":event=>FBZAdmin.inspectProvider('competition',event),
  "admin.emblems-prepare":()=>FBZAdmin.clubEmblems('prepare'),
  "admin.emblems-missing":()=>FBZAdmin.clubEmblems('missing'),
  "admin.emblems-reset":()=>FBZAdmin.resetEmblems(),
  "admin.emblems-apply":()=>FBZAdmin.clubEmblems('apply'),
  "admin.emblems-undo":()=>FBZAdmin.clubEmblems('undo'),
  "admin.lineup-prepare":event=>FBZAdmin.matchLineup('prepare',event),
  "admin.lineup-apply":()=>FBZAdmin.matchLineup('apply'),
  "admin.lineup-reset":()=>FBZAdmin.resetLineup(),
  "admin.admin-open-editor":(event,element,[id])=>FBZAdmin.openEditor(id),
  "admin.admin-refresh":()=>FBZAdmin.refresh(true)
});

