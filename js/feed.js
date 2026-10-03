(function(){
  'use strict';

  const PAGE_SIZE=12;
  let scope='all';
  let cursor=null;
  let loadedCount=0;
  let hasMore=false;
  let loadingMore=false;
  let requestVersion=0;
  let viewVersion=0;
  let homeVersion=0;
  let sessionVersion=0;
  const seenRatings=new Set();
  const openComments=new Set();
  const commentCache=new Map();
  const commentRequests=new Map();

  function displayName(item){return item.user?.display_name||item.user?.username||'Болельщик';}

  function initials(value){
    return String(value||'F').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
  }

  function avatar(item,className='feed-avatar'){
    const name=displayName(item);
    const image=safeImageUrl(item.user?.avatar_url);
    return image?`<span class="${className} has-image"><img src="${image}" alt="" loading="lazy" decoding="async"></span>`:`<span class="${className} ${avColor(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
  }

  function relativeDate(value){
    const date=new Date(value);
    const diff=Math.max(0,Date.now()-date.getTime());
    const minutes=Math.floor(diff/60000);
    if(minutes<1)return'сейчас';
    if(minutes<60)return`${minutes} мин`;
    const hours=Math.floor(minutes/60);
    if(hours<24)return`${hours} ч`;
    if(hours<48)return'вчера';
    return date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  }

  function score(match){
    if(match.home_score===null||match.home_score===undefined||match.away_score===null||match.away_score===undefined)return'— : —';
    return`${match.home_score} : ${match.away_score}`;
  }

  function clubButton(id,name,side,match){
    const mark=`<span aria-hidden="true">${matchClubMark(match||{},side,'feed-club-mark')}</span><span>${esc(FBZDomain.matchTeamName(match||{},side))}</span>`;
    if(!id)return`<span class="feed-team ${side}">${mark}</span>`;
    return`<button class="feed-team ${side}" type="button" ${FBZActions.attrs("feed.go-club",[Number(id)])}>${mark}</button>`;
  }

  function playerHighlights(items){
    if(!Array.isArray(items)||!items.length)return'';
    return`<div class="feed-players" aria-label="Оценки игроков">${items.map(player=>{const presentation=window.FBZDomain.ratingPresentation(player.rating,1);return`<button type="button" data-tone="${presentation.tone}" ${FBZActions.attrs("feed.go-player",[Number(player.player_id)])}><span>${player.is_best_player?'★':'●'}</span><b>${esc(player.name)}</b><strong>${presentation.value}</strong>${player.participation_verified===false?'<small class="feed-player-evidence">Участие не подтверждено</small>':''}</button>`;}).join('')}</div>`;
  }

  function renderFeedItem(item){
    const own=CU?.id===item.user_id;
    const rating=window.FBZDomain.ratingPresentation(item.match_rating);
    return`<article class="feed-entry" data-rating-id="${Number(item.rating_id)}">
      <header class="feed-entry-head">
        <button class="feed-author" type="button" ${FBZActions.attrs("app.go-profile",[item.user_id])}>
          ${avatar(item)}
          <span><strong>${esc(displayName(item))}</strong><small>@${esc(item.user?.username||'user')}</small></span>
        </button>
        <time datetime="${esc(item.created_at)}">${esc(relativeDate(item.created_at))}</time>
      </header>
      <div class="feed-match" style="${FBZDomain.matchPaletteStyle(item.match||{})}">
        <div class="feed-match-meta"><span>${esc(item.match?.league_name||'Футбол')}</span><time>${new Date(item.match?.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</time></div>
        <div class="feed-scoreline">
          ${clubButton(item.match?.home_club_id,item.match?.home_team_name,'home',item.match)}
          <button class="feed-score" type="button" ${FBZActions.attrs("feed.go-md",[Number(item.match_id)])} aria-label="Открыть матч: ${esc(item.match?.home_team_name||'Хозяева')} против ${esc(item.match?.away_team_name||'Гости')}, счёт ${esc(score(item.match||{}))}"><span class="mc-score-num">${esc(item.match?.home_score??'—')}<span class="mc-score-separator">:</span>${esc(item.match?.away_score??'—')}</span></button>
          ${clubButton(item.match?.away_club_id,item.match?.away_team_name,'away',item.match)}
        </div>
      </div>
      <div class="feed-verdict" data-tone="${rating.tone}" aria-label="Оценка матча ${rating.label}">
        <div class="feed-rating"><strong>${rating.value}</strong><span>/10</span></div>
        <div class="feed-rating-copy"><span>Оценка матча</span><div class="feed-rating-track" aria-hidden="true"><i style="--rating:${rating.progress}%"></i></div></div>
      </div>
      ${item.comment?`<blockquote>${esc(item.comment)}</blockquote>`:''}
      ${playerHighlights(item.player_highlights)}
      <footer class="feed-actions">
        <button class="feed-action like-action${item.liked_by_me?' on':''}" type="button" ${own?'disabled title="Свою запись нельзя оценить"':FBZActions.attrs('feed.toggle-like',[Number(item.rating_id)])} aria-pressed="${item.liked_by_me?'true':'false'}">${ico('heart',16)}<span>${Number(item.like_count)||0}</span><small>Нравится</small></button>
        <button class="feed-action" type="button" ${FBZActions.attrs("feed.toggle-comments",[Number(item.rating_id)])} aria-expanded="false" aria-controls="feed-comments-${Number(item.rating_id)}" aria-label="Обсудить оценку">${ico('chat',16)}<span data-comment-count>${Number(item.comment_count)||0}</span><small>Обсудить</small></button>
        ${own?`<button class="feed-action feed-edit" type="button" ${FBZActions.attrs("feed.open-rate",[Number(item.match_id)])} aria-label="Изменить оценку" title="Изменить оценку">${ico('edit',15)}<small>Изменить</small></button>`:''}
        ${!own&&CU?`<button class="feed-action feed-report" type="button" ${FBZActions.attrs('app.report-content',['rating',String(item.rating_id)])} aria-label="Пожаловаться на запись" title="Пожаловаться на запись">${ico('shield',16)}</button>`:''}
      </footer>
      <div class="feed-comments" id="feed-comments-${Number(item.rating_id)}" aria-live="polite"></div>
    </article>`;
  }

  function feedSkeleton(){
    return Array.from({length:3},()=>'<div class="feed-skeleton"><span></span><i></i><b></b><b></b></div>').join('');
  }

  function emptyState(){
    if((scope==='friends'||scope==='mine')&&!CU)return`<div class="feed-empty"><strong>Войди в профиль</strong><span>Этот раздел доступен авторизованным пользователям.</span><button class="btn btn-l" type="button" data-fbz-click="shell.open-auth">Войти</button></div>`;
    if(scope==='friends')return`<div class="feed-empty"><strong>Лента друзей пока пуста</strong><span>Найди знакомых в сообществе и следи за их футбольными оценками.</span><button class="btn btn-g" type="button" data-fbz-click="shell.go-friends">Найти друзей</button></div>`;
    if(scope==='mine')return`<div class="feed-empty"><strong>У тебя ещё нет публичных оценок</strong><span>Оцени завершённый матч, и запись появится здесь.</span><button class="btn btn-l" type="button" data-fbz-click="shell.go-matches">Открыть матчи</button></div>`;
    return`<div class="feed-empty"><strong>Лента пока пуста</strong><span>Первые публичные оценки появятся здесь.</span><button class="btn btn-l" type="button" data-fbz-click="shell.go-matches">Открыть матчи</button></div>`;
  }

  function scopeLabel(){return{all:'Все оценки',friends:'Оценки друзей',popular:'Популярное сейчас',mine:'Мои публикации'}[scope];}

  function renderMore(){
    const target=document.getElementById('feedMore');
    if(!target)return;
    target.innerHTML=hasMore?'<button class="feed-more-button" type="button" data-fbz-click="feed.load-more">Показать ещё</button>':'';
  }

  async function load(options={}){
    const append=Boolean(options.append);
    const target=document.getElementById('feedG');
    const meta=document.getElementById('feedMeta');
    if(!target)return;
    if(append&&loadingMore)return;
    if(!append){viewVersion++;cursor=null;loadedCount=0;hasMore=false;seenRatings.clear();openComments.clear();commentCache.clear();commentRequests.clear();target.innerHTML=feedSkeleton();}
    loadingMore=append;
    const version=++requestVersion;
    target.setAttribute('aria-busy','true');
    document.getElementById('feedMore').innerHTML=append?'<span class="feed-loading-more"><span class="spin"></span>Загружаем</span>':'';
    try{
      const{data,error}=await sb.rpc('get_social_feed_page',{
        p_scope:scope,
        p_limit:PAGE_SIZE,
        p_cursor_created_at:cursor?.created_at||null,
        p_cursor_rating_id:cursor?.rating_id||null,
        p_cursor_score:cursor?.score??null
      });
      if(error)throw error;
      if(version!==requestVersion)return;
      const pageItems=Array.isArray(data?.items)?data.items:[];
      await window.FBZData.enrichMatchMedia(pageItems.map(item=>item.match).filter(Boolean));
      if(version!==requestVersion)return;
      const items=pageItems.filter(item=>{
        const id=Number(item.rating_id);
        if(!Number.isFinite(id)||seenRatings.has(id))return false;
        seenRatings.add(id);
        return true;
      });
      cursor=data?.next_cursor&&typeof data.next_cursor==='object'?data.next_cursor:null;
      hasMore=Boolean(data?.has_more&&cursor);
      loadedCount+=items.length;
      if(append){if(items.length)target.insertAdjacentHTML('beforeend',items.map(renderFeedItem).join(''));}
      else target.innerHTML=items.length?items.map(renderFeedItem).join(''):emptyState();
      if(meta)meta.textContent=loadedCount?`${scopeLabel()} · ${loadedCount}`:scopeLabel();
      renderMore();
      injectIcons();
    }catch(error){
      console.error('Feed error:',error);
      if(version!==requestVersion)return;
      if(!append)target.innerHTML='<div class="feed-empty"><strong>Не удалось обновить ленту</strong><span>Проверь соединение и повтори попытку.</span><button class="btn btn-g" type="button" data-fbz-click="feed.load">Повторить</button></div>';
      renderMore();
      if(append)document.getElementById('feedMore').innerHTML='<div class="feed-page-error" role="status"><span>Не удалось загрузить следующие оценки</span><button class="feed-more-button" type="button" data-fbz-click="feed.load-more">Повторить</button></div>';
    }finally{if(version===requestVersion){loadingMore=false;target.setAttribute('aria-busy','false');}}
  }

  function loadMore(){if(hasMore)load({append:true});}

  function open(ratingId,commentId){
    return ratingId?focusRating(ratingId,commentId):load();
  }

  async function focusRating(ratingId,commentId){
    const id=Number(ratingId);
    if(!Number.isFinite(id))return;
    scope='all';
    document.querySelectorAll('#feedT .feed-filter').forEach((item,index)=>{
      item.classList.toggle('on',index===0);
      item.setAttribute('aria-pressed',String(index===0));
    });
    const token=++requestVersion,version=++viewVersion,user=CU?.id,target=document.getElementById('feedG');
    cursor=null;hasMore=false;loadedCount=0;seenRatings.clear();openComments.clear();commentCache.clear();commentRequests.clear();renderMore();
    target.innerHTML=feedSkeleton();target.setAttribute('aria-busy','true');
    const current=()=>token===requestVersion&&version===viewVersion&&user===CU?.id&&CP==='feed';
    try{
      const result=await sb.rpc('get_rating_entry',{p_rating_id:id});if(result.error)throw result.error;
      if(!current())return;
      if(!result.data){target.innerHTML='<div class="feed-empty"><strong>Запись больше недоступна</strong><span>Автор мог скрыть или удалить оценку.</span><button class="btn btn-g" type="button" data-fbz-click="feed.load">Вся лента</button></div>';return;}
      await window.FBZData.enrichMatchMedia([result.data.match].filter(Boolean));if(!current())return;
      target.innerHTML=renderFeedItem(result.data);document.getElementById('feedMeta').textContent='Оценка из уведомления';
      document.getElementById('feedMore').innerHTML='<button class="feed-more-button" type="button" data-fbz-click="feed.load">Вся лента</button>';
      const entry=target.querySelector(`[data-rating-id="${id}"]`);entry.classList.add('focused');entry.scrollIntoView({block:'center'});
      if(Number(commentId)>0){
        await toggleComments(id);if(!current()||!openComments.has(id))return;
        let comments=commentCache.get(id)||[];
        if(!comments.some(comment=>Number(comment.id)===Number(commentId))){
          const result=await sb.rpc('get_rating_comment',{p_rating_id:id,p_comment_id:Number(commentId)});if(result.error)throw result.error;
          if(!current()||!openComments.has(id))return;
          if(result.data){comments=[...comments,result.data];commentCache.set(id,comments);renderComments(id,comments);}
        }
        const comment=entry.querySelector(`[data-comment-id="${Number(commentId)}"]`);
        if(comment){comment.classList.add('focused');comment.setAttribute('tabindex','-1');comment.focus({preventScroll:true});comment.scrollIntoView({block:'center'});}
        else toast('Комментарий больше недоступен','err');
      }
    }catch{if(current())target.innerHTML=`<div class="feed-empty"><strong>Не удалось открыть запись</strong><button class="btn btn-g" type="button" ${FBZActions.attrs('feed.retry-entry',[id,Number(commentId)||null])}>Повторить</button></div>`;}
    finally{if(current())target.setAttribute('aria-busy','false');}
  }

  function setScope(next,button){
    if(!['all','friends','popular','mine'].includes(next))return;
    if((next==='friends'||next==='mine')&&!CU){openAuth();return;}
    scope=next;
    document.querySelectorAll('#feedT .feed-filter').forEach(item=>{
      const active=item===button;
      item.classList.toggle('on',active);
      item.setAttribute('aria-pressed',String(active));
    });
    load();
  }

  async function toggleLike(ratingId,button){
    if(!CU){openAuth();return;}
    if(button.disabled)return;
    button.disabled=true;
    try{
      const{data,error}=await sb.rpc('toggle_rating_like',{p_rating_id:Number(ratingId)});
      if(error)throw error;
      button.classList.toggle('on',Boolean(data?.liked));
      button.setAttribute('aria-pressed',String(Boolean(data?.liked)));
      const count=button.querySelector('span');
      if(count)count.textContent=Number(data?.like_count)||0;
    }catch(error){
      console.error('Like error:',error);
      toast('Не удалось сохранить реакцию','err');
    }finally{button.disabled=false;}
  }

  function commentAvatar(comment){
    const item={user:comment.user};
    return avatar(item,'comment-avatar');
  }

  function commentMarkup(comment,ratingId){
    return`<div class="feed-comment" data-comment-id="${Number(comment.id)}">
      ${commentAvatar(comment)}
      <div><div class="feed-comment-head"><button type="button" ${FBZActions.attrs("app.go-profile",[comment.user_id])}>@${esc(comment.user?.username||'user')}</button><time datetime="${esc(comment.created_at)}">${new Date(comment.created_at).toLocaleDateString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time>${comment.edited_at?'<small>ред.</small>':''}${comment.can_edit?`<button class="comment-edit" type="button" ${FBZActions.attrs("feed.edit-comment",[Number(ratingId),Number(comment.id)])}>Изменить</button>`:''}${comment.can_delete?`<button class="comment-delete" type="button" ${FBZActions.attrs("feed.delete-comment",[Number(ratingId),Number(comment.id)])} aria-label="Удалить комментарий" title="Удалить">×</button>`:''}${CU&&CU.id!==comment.user_id?`<button class="comment-report" type="button" ${FBZActions.attrs('app.report-content',['comment',String(comment.id)])} aria-label="Пожаловаться на комментарий" title="Пожаловаться на комментарий">${ico('shield',14)}</button>`:''}</div><p>${esc(comment.comment)}</p></div>
    </div>`;
  }

  function commentComposer(ratingId){
    if(!CU)return'<button class="comment-signin" type="button" data-fbz-click="shell.open-auth">Войти, чтобы комментировать</button>';
    return`<form class="comment-form" ${FBZActions.attrs("feed.add-comment",[Number(ratingId)],"submit")}><label class="sr-only" for="comment-${Number(ratingId)}">Комментарий</label><input id="comment-${Number(ratingId)}" maxlength="1000" autocomplete="off" placeholder="Написать комментарий"><button type="submit" aria-label="Отправить" title="Отправить">${ico('send',16)}</button></form>`;
  }

  function renderComments(ratingId,comments){
    const target=document.getElementById(`feed-comments-${Number(ratingId)}`);
    if(!target)return;
    target.innerHTML=`<div class="feed-comment-list">${comments.length?comments.map(comment=>commentMarkup(comment,ratingId)).join(''):'<div class="comments-empty">Начни обсуждение</div>'}</div>${commentComposer(ratingId)}`;
  }

  async function toggleComments(ratingId){
    const id=Number(ratingId);
    const target=document.getElementById(`feed-comments-${id}`);
    if(!target)return;
    const toggle=document.querySelector(`[aria-controls="feed-comments-${id}"]`);
    if(openComments.has(id)){openComments.delete(id);commentRequests.delete(id);target.innerHTML='';toggle?.setAttribute('aria-expanded','false');return;}
    openComments.add(id);
    toggle?.setAttribute('aria-expanded','true');
    target.innerHTML='<div class="comments-loading"><span class="spin"></span>Загружаем обсуждение</div>';
    if(commentCache.has(id)){renderComments(id,commentCache.get(id));return;}
    const request={version:viewVersion,userId:CU?.id};commentRequests.set(id,request);
    try{
      const{data,error}=await sb.rpc('get_rating_comments',{p_rating_id:id,p_limit:60});
      if(error)throw error;
      if(commentRequests.get(id)!==request||request.version!==viewVersion||request.userId!==CU?.id)return;
      const comments=Array.isArray(data)?data:[];
      commentCache.set(id,comments);
      if(openComments.has(id))renderComments(id,comments);
    }catch(error){
      if(commentRequests.get(id)!==request||request.version!==viewVersion||request.userId!==CU?.id)return;
      console.error('Comments error:',error);
      target.innerHTML=`<button class="comments-retry" type="button" ${FBZActions.attrs('feed.retry-comments',[id])}>Не удалось загрузить · повторить</button>`;
    }
  }

  function updateCommentCount(ratingId,value){
    const count=document.querySelector(`[data-rating-id="${Number(ratingId)}"] [data-comment-count]`);
    if(count)count.textContent=Math.max(0,Number(value)||0);
  }

  function adjustCommentCount(ratingId,delta){
    const count=document.querySelector(`[data-rating-id="${Number(ratingId)}"] [data-comment-count]`);
    if(count)updateCommentCount(ratingId,(Number(count.textContent)||0)+delta);
  }

  async function addComment(event,ratingId){
    event.preventDefault();
    if(!CU){openAuth();return;}
    const form=event.target.closest('form');
    const input=form.querySelector('input');
    const button=form.querySelector('button');
    if(button.disabled)return;
    const comment=input.value.trim();
    if(!comment)return;
    const version=viewVersion,userId=CU.id;
    button.disabled=true;
    try{
      const{data,error}=await sb.rpc('add_rating_comment',{p_rating_id:Number(ratingId),p_comment:comment});
      if(error)throw error;
      if(version!==viewVersion||userId!==CU?.id)return;
      const comments=[...(commentCache.get(Number(ratingId))||[]),data];
      commentCache.set(Number(ratingId),comments);
      if(openComments.has(Number(ratingId)))renderComments(ratingId,comments);
      adjustCommentCount(ratingId,1);
      document.getElementById(`comment-${Number(ratingId)}`)?.focus();
    }catch(error){
      if(version===viewVersion&&userId===CU?.id){console.error('Add comment error:',error);toast('Не удалось отправить комментарий','err');}
    }finally{button.disabled=false;}
  }

  function deleteComment(ratingId,commentId,button){
    if(button.disabled)return;
    window.FBZConfirm.open({title:'Удалить комментарий?',message:'Комментарий будет удалён из обсуждения.',confirmText:'Удалить',onConfirm:()=>removeComment(ratingId,commentId,button)});
  }

  async function removeComment(ratingId,commentId,button){
    const version=viewVersion,userId=CU?.id;
    button.disabled=true;
    try{
      const{data,error}=await sb.rpc('delete_rating_comment',{p_comment_id:Number(commentId)});
      if(error)throw error;
      if(!data)throw new Error('Comment was not deleted');
      if(version!==viewVersion||userId!==CU?.id)return true;
      const comments=(commentCache.get(Number(ratingId))||[]).filter(comment=>Number(comment.id)!==Number(commentId));
      commentCache.set(Number(ratingId),comments);
      if(openComments.has(Number(ratingId)))renderComments(ratingId,comments);
      adjustCommentCount(ratingId,-1);
      return true;
    }catch(error){
      console.error('Delete comment error:',error);
      toast('Не удалось удалить комментарий','err');
      return false;
    }finally{button.disabled=false;}
  }

  function editComment(ratingId,commentId){
    const comments=commentCache.get(Number(ratingId))||[];
    const comment=comments.find(item=>Number(item.id)===Number(commentId));
    if(!comment)return;
    const host=document.querySelector(`[data-rating-id="${Number(ratingId)}"] [data-comment-id="${Number(commentId)}"] p`);
    if(!host)return;
    host.outerHTML=`<form class="comment-edit-form" ${FBZActions.attrs("feed.save-comment-edit",[Number(ratingId),Number(commentId)],"submit")}><label class="sr-only" for="edit-comment-${Number(commentId)}">Изменить комментарий</label><textarea id="edit-comment-${Number(commentId)}" maxlength="1000" rows="3" required>${esc(comment.comment)}</textarea><div><button class="btn btn-g btn-sm" type="button" ${FBZActions.attrs("feed.cancel-comment-edit",[Number(ratingId)])}>Отмена</button><button class="btn btn-l btn-sm" type="submit">Сохранить</button></div></form>`;
    document.getElementById(`edit-comment-${Number(commentId)}`)?.focus({preventScroll:true});
  }

  function cancelCommentEdit(ratingId){renderComments(ratingId,commentCache.get(Number(ratingId))||[]);}

  async function saveCommentEdit(event,ratingId,commentId){
    event.preventDefault();
    const form=event.target.closest('form'),button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    const updated=form.querySelector('textarea').value.trim();
    if(!updated||updated.length>1000){toast('Введите комментарий от 1 до 1000 символов','err');return;}
    const comments=commentCache.get(Number(ratingId))||[],comment=comments.find(item=>Number(item.id)===Number(commentId));
    if(!comment)return;
    const version=viewVersion,userId=CU?.id;button.disabled=true;
    try{
      const{data,error}=await sb.rpc('edit_rating_comment',{p_comment_id:Number(commentId),p_comment:updated});
      if(error)throw error;
      if(version!==viewVersion||userId!==CU?.id)return;
      Object.assign(comment,data,{user:comment.user});
      if(openComments.has(Number(ratingId)))renderComments(ratingId,comments);
    }catch(error){if(version===viewVersion&&userId===CU?.id){console.error('Edit comment error:',error);toast('Не удалось изменить комментарий','err');}}
    finally{button.disabled=false;}
  }

  function renderHomeItem(item){
    const rating=window.FBZDomain.ratingPresentation(item.match_rating);
    return`<article class="home-feed-card" data-tone="${rating.tone}">
      <header>${avatar(item,'home-feed-avatar')}<span><strong>${esc(displayName(item))}</strong><small>${esc(relativeDate(item.created_at))}</small></span><b aria-label="Оценка ${rating.label}">${rating.label}</b></header>
      <button class="home-feed-match" type="button" ${FBZActions.attrs("feed.go-md",[Number(item.match_id)])}><small>${esc(item.match?.league_name||'')}</small><strong>${esc(item.match?.home_team_name)} <span>${esc(score(item.match||{}))}</span> ${esc(item.match?.away_team_name)}</strong></button>
      ${item.comment?`<p>${esc(item.comment)}</p>`:''}
      <footer><span>${ico('heart',13)} ${Number(item.like_count)||0}</span><button type="button" ${FBZActions.attrs("feed.go-feed",[Number(item.rating_id)])}>Открыть в ленте →</button></footer>
    </article>`;
  }

  async function loadHome(){
    const version=++homeVersion,session=sessionVersion;
    const target=document.getElementById('homeF');
    if(!target)return;
    try{
      const{data,error}=await sb.rpc('get_social_feed_page',{
        p_scope:'all',p_limit:3,p_cursor_created_at:null,p_cursor_rating_id:null,p_cursor_score:null
      });
      if(error)throw error;
      if(version!==homeVersion||session!==sessionVersion)return;
      const items=Array.isArray(data?.items)?data.items:[];
      target.innerHTML=items.length?items.map(renderHomeItem).join(''):'<div class="empty-state"><strong>Оценки появятся здесь</strong></div>';
    }catch(error){
      if(version!==homeVersion||session!==sessionVersion)return;
      console.warn('Home feed error:',error);
      target.innerHTML='<div class="empty-state"><strong>Лента временно недоступна</strong></div>';
    }
  }

  window.loadHomeF=loadHome;
  window.loadFeed=load;
  window.setFS=setScope;
  function resetSession(){
    requestVersion++;viewVersion++;homeVersion++;sessionVersion++;scope='all';cursor=null;loadedCount=0;hasMore=false;loadingMore=false;
    seenRatings.clear();openComments.clear();commentCache.clear();commentRequests.clear();
    document.getElementById('feedG')?.replaceChildren();document.getElementById('homeF')?.replaceChildren();
    document.getElementById('feedMore')?.replaceChildren();
    document.querySelectorAll('#feedT .feed-filter').forEach((item,index)=>{item.classList.toggle('on',index===0);item.setAttribute('aria-pressed',String(index===0));});
  }

  window.FBZFeed={addComment,cancelCommentEdit,deleteComment,editComment,focusRating,load,loadHome,loadMore,open,resetSession,saveCommentEdit,setScope,toggleComments,toggleLike};
})();

// Explicit action bindings; parameters are JSON data, never executable code.
FBZActions.register({
  "feed.toggle-like":(event,element,[id])=>FBZFeed.toggleLike(id,element),
  "feed.retry-comments":(event,element,[id])=>{FBZFeed.toggleComments(id);return FBZFeed.toggleComments(id);},
  "feed.go-club":(event,element,[id])=>go('club',{id:id}),
  "feed.go-player":(event,element,[id])=>go('player',{id:id}),
  "feed.go-md":(event,element,[id])=>go('md',{mid:id}),
  "feed.toggle-comments":(event,element,[id])=>FBZFeed.toggleComments(id,element),
  "feed.open-rate":(event,element,[id])=>openRate(id),
  "feed.load-more":()=>FBZFeed.loadMore(),
  "feed.load":()=>FBZFeed.load(),
  "feed.retry-entry":(event,element,[id,commentId])=>FBZFeed.focusRating(id,commentId),
  "feed.edit-comment":(event,element,[ratingId,commentId])=>FBZFeed.editComment(ratingId,commentId),
  "feed.delete-comment":(event,element,[ratingId,commentId])=>FBZFeed.deleteComment(ratingId,commentId,element),
  "feed.add-comment":(event,element,[id])=>FBZFeed.addComment(event,id),
  "feed.save-comment-edit":(event,element,[ratingId,commentId])=>FBZFeed.saveCommentEdit(event,ratingId,commentId),
  "feed.cancel-comment-edit":(event,element,[id])=>FBZFeed.cancelCommentEdit(id),
  "feed.go-feed":(event,element,[id])=>go('feed',{ratingId:id})
});
