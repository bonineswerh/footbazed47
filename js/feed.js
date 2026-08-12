(function(){
  'use strict';

  const PAGE_SIZE=12;
  let scope='all';
  let cursor=null;
  let loadedCount=0;
  let hasMore=false;
  let loadingMore=false;
  let requestVersion=0;
  const seenRatings=new Set();
  const openComments=new Set();
  const commentCache=new Map();

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

  function clubButton(id,name,side){
    if(!id)return`<span class="feed-team ${side}">${esc(name)}</span>`;
    return`<button class="feed-team ${side}" type="button" onclick="go('club',{id:${Number(id)}})">${esc(name)}</button>`;
  }

  function playerHighlights(items){
    if(!Array.isArray(items)||!items.length)return'';
    return`<div class="feed-players" aria-label="Оценки игроков">${items.map(player=>`<button type="button" onclick="go('player',{id:${Number(player.player_id)}})"><span>${player.is_best_player?'★':'●'}</span><b>${esc(player.name)}</b><strong>${Number(player.rating).toFixed(1)}</strong></button>`).join('')}</div>`;
  }

  function renderFeedItem(item){
    const own=CU?.id===item.user_id;
    const rating=Math.max(0,Math.min(10,Number(item.match_rating)||0));
    return`<article class="feed-entry" data-rating-id="${Number(item.rating_id)}">
      <header class="feed-entry-head">
        <button class="feed-author" type="button" onclick="go('profile',{uid:${jsStr(item.user_id)}})">
          ${avatar(item)}
          <span><strong>${esc(displayName(item))}</strong><small>@${esc(item.user?.username||'user')}</small></span>
        </button>
        <time datetime="${esc(item.created_at)}">${esc(relativeDate(item.created_at))}</time>
      </header>
      <div class="feed-match">
        <div class="feed-match-meta"><span>${esc(item.match?.league_name||'Футбол')}</span><time>${new Date(item.match?.match_date).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</time></div>
        <div class="feed-scoreline">
          ${clubButton(item.match?.home_club_id,item.match?.home_team_name,'home')}
          <button class="feed-score" type="button" onclick="go('md',{mid:${Number(item.match_id)}})" aria-label="Открыть матч"><span>${esc(score(item.match||{}))}</span><small>Матч →</small></button>
          ${clubButton(item.match?.away_club_id,item.match?.away_team_name,'away')}
        </div>
      </div>
      <div class="feed-verdict">
        <div class="feed-rating"><strong>${rating}</strong><span>/10</span></div>
        <div class="feed-rating-copy"><span>Оценка матча</span><div class="feed-rating-track"><i style="--rating:${rating*10}%"></i></div></div>
      </div>
      ${item.comment?`<blockquote>${esc(item.comment)}</blockquote>`:''}
      ${playerHighlights(item.player_highlights)}
      <footer class="feed-actions">
        <button class="feed-action like-action${item.liked_by_me?' on':''}" type="button" ${own?'disabled title="Свою запись нельзя оценить"':`onclick="FBZFeed.toggleLike(${Number(item.rating_id)},this)"`} aria-pressed="${item.liked_by_me?'true':'false'}">${ico('heart',16)}<span>${Number(item.like_count)||0}</span><small>Нравится</small></button>
        <button class="feed-action" type="button" onclick="FBZFeed.toggleComments(${Number(item.rating_id)},this)">${ico('chat',16)}<span data-comment-count>${Number(item.comment_count)||0}</span><small>Обсудить</small></button>
        ${own?`<button class="feed-action feed-edit" type="button" onclick="openRate(${Number(item.match_id)})" aria-label="Изменить оценку" title="Изменить оценку">${ico('edit',15)}<small>Изменить</small></button>`:''}
      </footer>
      <div class="feed-comments" id="feed-comments-${Number(item.rating_id)}" aria-live="polite"></div>
    </article>`;
  }

  function feedSkeleton(){
    return Array.from({length:3},()=>'<div class="feed-skeleton"><span></span><i></i><b></b><b></b></div>').join('');
  }

  function emptyState(){
    if((scope==='friends'||scope==='mine')&&!CU)return`<div class="feed-empty"><strong>Войди в профиль</strong><span>Этот раздел доступен авторизованным пользователям.</span><button class="btn btn-l" type="button" onclick="openAuth()">Войти</button></div>`;
    if(scope==='friends')return`<div class="feed-empty"><strong>Лента друзей пока пуста</strong><span>Найди знакомых в сообществе и следи за их футбольными оценками.</span><button class="btn btn-g" type="button" onclick="go('friends')">Найти друзей</button></div>`;
    if(scope==='mine')return`<div class="feed-empty"><strong>У тебя ещё нет публичных оценок</strong><span>Оцени завершённый матч, и запись появится здесь.</span><button class="btn btn-l" type="button" onclick="go('matches')">Открыть матчи</button></div>`;
    return`<div class="feed-empty"><strong>Лента пока пуста</strong><span>Первые публичные оценки появятся здесь.</span><button class="btn btn-l" type="button" onclick="go('matches')">Открыть матчи</button></div>`;
  }

  function scopeLabel(){return{all:'Все оценки',friends:'Оценки друзей',popular:'Популярное сейчас',mine:'Мои публикации'}[scope];}

  function renderMore(){
    const target=document.getElementById('feedMore');
    if(!target)return;
    target.innerHTML=hasMore?'<button class="feed-more-button" type="button" onclick="FBZFeed.loadMore()">Показать ещё</button>':'';
  }

  async function load(options={}){
    const append=Boolean(options.append);
    const target=document.getElementById('feedG');
    const meta=document.getElementById('feedMeta');
    if(!target)return;
    if(append&&loadingMore)return;
    if(!append){cursor=null;loadedCount=0;seenRatings.clear();openComments.clear();commentCache.clear();target.innerHTML=feedSkeleton();}
    loadingMore=append;
    const version=++requestVersion;
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
      const items=pageItems.filter(item=>{
        const id=Number(item.rating_id);
        if(!Number.isFinite(id)||seenRatings.has(id))return false;
        seenRatings.add(id);
        return true;
      });
      cursor=data?.next_cursor&&typeof data.next_cursor==='object'?data.next_cursor:null;
      hasMore=Boolean(data?.has_more&&cursor);
      loadedCount+=items.length;
      if(append&&items.length)target.insertAdjacentHTML('beforeend',items.map(renderFeedItem).join(''));
      else target.innerHTML=items.length?items.map(renderFeedItem).join(''):emptyState();
      if(meta)meta.textContent=loadedCount?`${scopeLabel()} · ${loadedCount}`:scopeLabel();
      renderMore();
      injectIcons();
    }catch(error){
      console.error('Feed error:',error);
      if(version!==requestVersion)return;
      if(!append)target.innerHTML='<div class="feed-empty"><strong>Не удалось обновить ленту</strong><span>Проверь соединение и повтори попытку.</span><button class="btn btn-g" type="button" onclick="FBZFeed.load()">Повторить</button></div>';
      renderMore();
    }finally{loadingMore=false;}
  }

  function loadMore(){if(hasMore)load({append:true});}

  function open(ratingId){
    return ratingId?focusRating(ratingId):load();
  }

  async function focusRating(ratingId){
    const id=Number(ratingId);
    if(!Number.isFinite(id))return;
    scope='all';
    document.querySelectorAll('#feedT .feed-filter').forEach((item,index)=>{
      item.classList.toggle('on',index===0);
      item.setAttribute('aria-pressed',String(index===0));
    });
    await load();
    for(let attempt=0;attempt<9&&!document.querySelector(`[data-rating-id="${id}"]`)&&hasMore;attempt++)await load({append:true});
    const entry=document.querySelector(`[data-rating-id="${id}"]`);
    if(!entry){toast('Запись больше недоступна','err');return;}
    entry.scrollIntoView({behavior:'smooth',block:'center'});
    entry.classList.add('focused');
    setTimeout(()=>entry.classList.remove('focused'),1800);
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
      <div><div class="feed-comment-head"><button type="button" onclick="go('profile',{uid:${jsStr(comment.user_id)}})">@${esc(comment.user?.username||'user')}</button><time>${esc(relativeDate(comment.created_at))}</time>${comment.can_delete?`<button class="comment-delete" type="button" onclick="FBZFeed.deleteComment(${Number(ratingId)},${Number(comment.id)},this)" aria-label="Удалить комментарий" title="Удалить">×</button>`:''}</div><p>${esc(comment.comment)}</p></div>
    </div>`;
  }

  function commentComposer(ratingId){
    if(!CU)return'<button class="comment-signin" type="button" onclick="openAuth()">Войти, чтобы комментировать</button>';
    return`<form class="comment-form" onsubmit="FBZFeed.addComment(event,${Number(ratingId)})"><label class="sr-only" for="comment-${Number(ratingId)}">Комментарий</label><input id="comment-${Number(ratingId)}" maxlength="1000" autocomplete="off" placeholder="Написать комментарий"><button type="submit" aria-label="Отправить" title="Отправить">${ico('send',16)}</button></form>`;
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
    if(openComments.has(id)){openComments.delete(id);target.innerHTML='';return;}
    openComments.add(id);
    target.innerHTML='<div class="comments-loading"><span class="spin"></span>Загружаем обсуждение</div>';
    if(commentCache.has(id)){renderComments(id,commentCache.get(id));return;}
    try{
      const{data,error}=await sb.rpc('get_rating_comments',{p_rating_id:id,p_limit:60});
      if(error)throw error;
      const comments=Array.isArray(data)?data:[];
      commentCache.set(id,comments);
      if(openComments.has(id))renderComments(id,comments);
    }catch(error){
      console.error('Comments error:',error);
      target.innerHTML='<button class="comments-retry" type="button" onclick="FBZFeed.toggleComments('+id+');FBZFeed.toggleComments('+id+')">Не удалось загрузить · повторить</button>';
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
    const form=event.currentTarget;
    const input=form.querySelector('input');
    const button=form.querySelector('button');
    const comment=input.value.trim();
    if(!comment)return;
    button.disabled=true;
    try{
      const{data,error}=await sb.rpc('add_rating_comment',{p_rating_id:Number(ratingId),p_comment:comment});
      if(error)throw error;
      const comments=[...(commentCache.get(Number(ratingId))||[]),data];
      commentCache.set(Number(ratingId),comments);
      renderComments(ratingId,comments);
      adjustCommentCount(ratingId,1);
      document.getElementById(`comment-${Number(ratingId)}`)?.focus();
    }catch(error){
      console.error('Add comment error:',error);
      toast('Не удалось отправить комментарий','err');
      button.disabled=false;
    }
  }

  async function deleteComment(ratingId,commentId,button){
    button.disabled=true;
    try{
      const{data,error}=await sb.rpc('delete_rating_comment',{p_comment_id:Number(commentId)});
      if(error)throw error;
      if(!data)throw new Error('Comment was not deleted');
      const comments=(commentCache.get(Number(ratingId))||[]).filter(comment=>Number(comment.id)!==Number(commentId));
      commentCache.set(Number(ratingId),comments);
      renderComments(ratingId,comments);
      adjustCommentCount(ratingId,-1);
    }catch(error){
      console.error('Delete comment error:',error);
      toast('Не удалось удалить комментарий','err');
      button.disabled=false;
    }
  }

  function renderHomeItem(item){
    const rating=Math.max(0,Math.min(10,Number(item.match_rating)||0));
    return`<article class="home-feed-card">
      <header>${avatar(item,'home-feed-avatar')}<span><strong>${esc(displayName(item))}</strong><small>${esc(relativeDate(item.created_at))}</small></span><b>${rating}</b></header>
      <button class="home-feed-match" type="button" onclick="go('md',{mid:${Number(item.match_id)}})"><small>${esc(item.match?.league_name||'')}</small><strong>${esc(item.match?.home_team_name)} <span>${esc(score(item.match||{}))}</span> ${esc(item.match?.away_team_name)}</strong></button>
      ${item.comment?`<p>${esc(item.comment)}</p>`:''}
      <footer><span>${ico('heart',13)} ${Number(item.like_count)||0}</span><button type="button" onclick="go('feed')">Открыть в ленте →</button></footer>
    </article>`;
  }

  async function loadHome(){
    const target=document.getElementById('homeF');
    if(!target)return;
    try{
      const{data,error}=await sb.rpc('get_social_feed_page',{
        p_scope:'all',p_limit:3,p_cursor_created_at:null,p_cursor_rating_id:null,p_cursor_score:null
      });
      if(error)throw error;
      const items=Array.isArray(data?.items)?data.items:[];
      target.innerHTML=items.length?items.map(renderHomeItem).join(''):'<div class="empty-state"><strong>Оценки появятся здесь</strong></div>';
    }catch(error){
      console.warn('Home feed error:',error);
      target.innerHTML='<div class="empty-state"><strong>Лента временно недоступна</strong></div>';
    }
  }

  window.loadHomeF=loadHome;
  window.loadFeed=load;
  window.setFS=setScope;
  window.FBZFeed={addComment,deleteComment,focusRating,load,loadHome,loadMore,open,setScope,toggleComments,toggleLike};
})();
