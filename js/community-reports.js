(function(root){
  'use strict';
  const overlayId='reportOverlay';
  const reasons={harassment:'Оскорбления или травля',hate:'Разжигание ненависти',spam:'Спам или реклама',impersonation:'Выдаёт себя за другого',other:'Другая причина'};
  const statuses={open:'Ожидает решения',reviewed:'Рассмотрена',dismissed:'Отклонена'};
  const types={rating:'Запись',comment:'Комментарий',profile:'Профиль'};
  let state=null;
  function current(s){return state===s&&CU?.id===s.user&&routeVersion===s.route;}
  function mount(){
    if(document.getElementById(overlayId))return;
    const overlay=document.createElement('div');overlay.id=overlayId;overlay.className='overlay report-overlay';overlay.tabIndex=-1;
    overlay.setAttribute('aria-hidden','true');overlay.dataset.closeBackdrop='true';
    overlay.innerHTML='<section class="report-panel" role="dialog" aria-modal="true" aria-labelledby="reportTitle" aria-describedby="reportHelp">'
      +'<header><div><span class="section-kicker">Сообщество</span><h2 id="reportTitle">Пожаловаться</h2></div><button class="btn btn-g report-close" type="button" aria-label="Закрыть жалобу" data-fbz-click="report.close">'+ico('close',20)+'</button></header>'
      +'<p id="reportHelp">Обращение увидит администратор. Автору записи не сообщаем, кто отправил жалобу. Несогласие с оценкой само по себе не является нарушением.</p>'
      +'<form id="reportForm" data-fbz-submit="report.submit"><label for="reportReason">Причина</label><select class="input" id="reportReason" name="reason" required><option value="">Выберите причину</option>'+Object.entries(reasons).map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select>'
      +'<label for="reportDetails">Подробности <span>необязательно</span></label><textarea class="input" id="reportDetails" name="details" rows="4" maxlength="1000" aria-describedby="reportDetailsHelp"></textarea><small id="reportDetailsHelp">До 1000 символов. Опишите, что нужно проверить.</small>'
      +'<p id="reportStatus" class="report-status" role="status" aria-live="polite"></p><footer><button class="btn btn-g" type="button" data-fbz-click="report.close">Отмена</button><button class="btn btn-l" type="submit">Отправить жалобу</button></footer></form><div id="reportHistory" hidden></div></section>';
    overlay.addEventListener('fbz:overlay-close',()=>{state=null;overlay.querySelector('form').reset();document.getElementById('reportStatus').textContent='';document.getElementById('reportHistory').replaceChildren();});
    document.body.append(overlay);
  }
  function open(type,id){
    if(!CU)return openAuth();
    if(!['rating','comment','profile'].includes(type))return;
    mount();close(false);state={type,id:String(id),user:CU.id,route:routeVersion,busy:false};
    document.getElementById('reportForm').hidden=false;document.getElementById('reportHistory').hidden=true;
    document.getElementById('reportHelp').textContent='Обращение увидит администратор. Автору записи не сообщаем, кто отправил жалобу. Несогласие с оценкой само по себе не является нарушением.';
    document.getElementById('reportForm').reset();document.getElementById('reportForm').querySelector('[type="submit"]').disabled=false;
    document.getElementById('reportStatus').textContent='';
    document.getElementById('reportTitle').textContent=({rating:'Жалоба на запись',comment:'Жалоба на комментарий',profile:'Жалоба на профиль'})[type];
    document.querySelector('.report-close').setAttribute('aria-label','Закрыть жалобу');
    root.FBZOverlay.open(overlayId,'#reportReason');
  }
  function close(restore=true){root.FBZOverlay.close(overlayId,restore);state=null;}
  function history(){
    if(!CU)return openAuth();
    mount();close(false);state={mode:'history',user:CU.id,route:routeVersion,offset:0,version:0,busy:false,hasMore:false};
    document.getElementById('reportTitle').textContent='Мои обращения';document.getElementById('reportHelp').textContent='Здесь только ваши жалобы. Проверка обращения не меняет оценки и не ограничивает аккаунты автоматически.';
    document.querySelector('.report-close').setAttribute('aria-label','Закрыть обращения');
    document.getElementById('reportForm').hidden=true;document.getElementById('reportHistory').hidden=false;
    root.FBZOverlay.open(overlayId,'.report-close');return loadHistory();
  }
  async function loadHistory(){
    const s=state;if(!s||s.mode!=='history'||!current(s))return;
    const version=++s.version,host=document.getElementById('reportHistory');s.busy=true;host.setAttribute('aria-busy','true');
    host.innerHTML='<div class="loading" role="status"><div class="spin"></div><span class="sr-only">Загрузка обращений</span></div>';
    try{
      // RLS scopes this read to auth.uid(). Snapshot, staff identity and other reporters are not granted.
      const {data,error,count}=await sb.from('community_reports').select('id,target_type,target_id,reason,details,status,created_at,reviewed_at,decision_note',{count:'exact'}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(s.offset,s.offset+9);
      if(error)throw error;
      if(!current(s)||version!==s.version)return;
      const items=Array.isArray(data)?data:[],total=Number(count)||0;s.hasMore=s.offset+items.length<total;
      host.innerHTML=items.length?'<ol class="report-history-list">'+items.map(r=>'<li><div><strong>'+esc(types[r.target_type]||'Обращение')+' · '+esc(reasons[r.reason]||'Другая причина')+'</strong><span>'+esc(statuses[r.status]||r.status)+'</span></div><time datetime="'+esc(r.created_at)+'">'+esc(new Date(r.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'}))+'</time>'+(r.details?'<p>'+esc(r.details)+'</p>':'')+(r.decision_note?'<p class="report-history-decision"><b>Решение администратора</b>'+esc(r.decision_note)+'</p>':'')+'</li>').join('')+'</ol>':'<div class="empty-state"><strong>Обращений пока нет</strong><p>Их можно отправить из ленты, комментария или профиля.</p></div>';
      host.insertAdjacentHTML('beforeend','<footer class="report-history-pagination"><span role="status">'+(items.length?(s.offset+1)+'–'+(s.offset+items.length)+' из '+total:'Нет обращений')+'</span><button class="btn btn-g btn-sm" type="button" data-fbz-click="report.previous" '+(s.offset===0?'disabled':'')+'>Назад</button><button class="btn btn-g btn-sm" type="button" data-fbz-click="report.next" '+(!s.hasMore?'disabled':'')+'>Далее →</button></footer>');
    }catch(error){if(current(s)&&version===s.version)host.innerHTML='<div class="collection-error" role="status"><span>Не удалось загрузить обращения</span><button class="btn btn-g" type="button" data-fbz-click="report.history-retry">Повторить</button></div>';}
    finally{if(current(s)&&version===s.version){s.busy=false;host.setAttribute('aria-busy','false');}}
  }
  function page(direction){const s=state;if(!s||s.mode!=='history'||s.busy)return;if(direction>0&&s.hasMore)s.offset+=10;else if(direction<0&&s.offset>0)s.offset=Math.max(0,s.offset-10);else return;loadHistory();document.querySelector('.report-panel')?.scrollTo({top:0,behavior:'instant'});}
  async function submit(event){
    event.preventDefault();const s=state,form=event.target;
    if(!s||!current(s)||s.busy||!form.reportValidity())return;
    s.busy=true;const button=form.querySelector('[type="submit"]'),status=document.getElementById('reportStatus');button.disabled=true;status.textContent='Отправляем обращение…';
    try{
      const {data,error}=await sb.rpc('submit_community_report',{p_target_type:s.type,p_target_id:s.id,p_reason:form.elements.reason.value,p_details:form.elements.details.value.trim()});
      if(error)throw error;
      if(!current(s))return;
      if(!data?.id)throw new Error('invalid_report_response');
      close();toast(data.duplicate?'Вы уже отправили жалобу. Она ожидает рассмотрения.':'Жалоба отправлена администратору.','ok');
    }catch(error){
      if(current(s))status.textContent=({report_rate_limit:'Вы уже отправили несколько жалоб. Попробуйте позже.',report_target_unavailable:'Эта запись больше недоступна для жалобы.',auth_required:'Сессия завершена. Войдите снова.'})[error.message]||'Не удалось отправить жалобу. Попробуйте ещё раз.';
    }finally{if(current(s)){s.busy=false;button.disabled=false;}}
  }
  root.FBZCommunityReports=Object.freeze({open,close,history});
  root.FBZActions.register({'report.close':()=>close(),'report.submit':event=>submit(event),'report.history-retry':()=>loadHistory(),'report.previous':()=>page(-1),'report.next':()=>page(1)});
  root.addEventListener('fbz:session-change',()=>close(false));
})(window);
