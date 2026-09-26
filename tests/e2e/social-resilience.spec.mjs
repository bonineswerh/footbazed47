import {expect,test} from '@playwright/test';
import {installSupabaseMock} from './mock-supabase.mjs';

const NATASHA='2b854020-9701-4f49-9c36-2b65c9dcd449';
const GAMLET='cd291181-2db6-42cb-9f3d-ef84ab3a9660';

test.beforeEach(async({page})=>{
  await installSupabaseMock(page);
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,route=>route.abort());
  page.__socialErrors=[];
  page.on('pageerror',error=>page.__socialErrors.push(error.message));
});

test.afterEach(async({page})=>{
  expect(page.__socialErrors).toEqual([]);
});

async function prepareChat(page){
  await page.goto('/friends?__e2e=1');
  await expect(page.locator('#accountBtn')).toContainText('bazed');
  await page.evaluate(async friendId=>{
    const result=await sb.rpc('respond_friendship',{p_requester_id:friendId,p_action:'accept'});
    if(result.error)throw new Error('Test friendship setup failed');
    await ensureMessagesModule();
  },NATASHA);
}

async function openChat(page){
  await page.evaluate(friendId=>FBZMessages.openFriend(friendId),NATASHA);
  await expect(page.locator('#directChatTitle')).toHaveText('Natasha');
  await expect(page.locator('#directChatInput')).toBeVisible();
}

test('поиск исправляет только известные повреждённые служебные подписи старого RPC',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='search_footbazed'?Promise.resolve({data:[
      {entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'РљР»СѓР±'},
      {entity_type:'match',entity_id:'101',title:'Real Madrid вЂ” Man City',subtitle:'Champions League',meta:'finished'},
      {entity_type:'club',entity_id:'25',title:'Динамо',subtitle:'Россия',meta:'DIN'}
    ],error:null}):original(name,args);
  });
  await page.locator('#globalSearchInput').fill('real');
  await expect(page.getByRole('option').first()).toHaveText('Real Madrid CFКлуб→');
  await expect(page.getByRole('option').nth(1)).toContainText('Real Madrid — Man City');
  await expect(page.getByRole('option').nth(2)).toContainText('ДинамоРоссия');
});

test('новый поисковый запрос сразу отменяет выбор прежнего результата с клавиатуры',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='search_footbazed'
      ?args.p_query==='Первый'
        ?Promise.resolve({data:[{entity_type:'club',entity_id:'24',title:'Первый клуб'}],error:null})
        :new Promise(resolve=>{window.__resolveSocialSearch=resolve;})
      :original(name,args);
  });
  const input=page.getByRole('combobox');
  await input.fill('Первый');
  await expect(page.getByRole('option',{name:/Первый клуб/})).toBeVisible();
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant','global-search-option-0');
  await input.fill('Второй');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('#searchOv')).toBeVisible();
  await expect(page).not.toHaveURL(/\/club\/24/u);
  await expect(input).not.toHaveAttribute('aria-activedescendant',/\S/u);
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveSocialSearch)).toBe('function');
  await page.evaluate(()=>window.__resolveSocialSearch({data:[{entity_type:'player',entity_id:'5290',title:'Thibaut Courtois'}],error:null}));
  await expect(page.getByRole('option',{name:/Thibaut Courtois/})).toBeVisible();
  await input.press('ArrowDown');await input.press('Enter');
  await expect(page).toHaveURL(/\/player\/5290\?__e2e=1$/u);
  await expect(page).toHaveTitle(/Thibaut Courtois/u);
});

test('ответ старого поиска во время debounce не заменяет новый запрос',async({page})=>{
  await page.goto('/?__e2e=1');
  await page.getByRole('button',{name:'Поиск',exact:true}).click();
  await expect(page.locator('#globalSearchInput')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    window.__socialSearchResolvers={};
    sb.rpc=(name,args)=>name==='search_footbazed'?new Promise(resolve=>{window.__socialSearchResolvers[args.p_query]=resolve;}):original(name,args);
  });
  await page.locator('#globalSearchInput').fill('Старый');
  await expect.poll(()=>page.evaluate(()=>typeof window.__socialSearchResolvers['Старый'])).toBe('function');
  await page.evaluate(()=>{
    const input=document.getElementById('globalSearchInput');
    input.value='Новый';input.dispatchEvent(new Event('input',{bubbles:true}));
    window.__socialSearchResolvers['Старый']({data:[{entity_type:'club',entity_id:'24',title:'Устаревший результат'}],error:null});
  });
  await expect(page.getByRole('option',{name:/Устаревший результат/})).toHaveCount(0);
  await expect(page.locator('#globalSearchResults')).toHaveAttribute('aria-busy','true');
  await expect.poll(()=>page.evaluate(()=>typeof window.__socialSearchResolvers['Новый'])).toBe('function');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__socialSearchResolvers['Новый']({data:[{entity_type:'club',entity_id:'24',title:'Поздний результат'}],error:null}));
  await page.keyboard.press('Control+k');
  await expect(page.locator('#globalSearchInput')).toHaveValue('');
  await expect(page.getByRole('option',{name:/Поздний результат/})).toHaveCount(0);
});

test('пустая следующая страница ленты сохраняет прочитанные оценки',async({page})=>{
  await page.goto('/feed?__e2e=1');
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await page.evaluate(async()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=async(name,args)=>{
      if(name!=='get_social_feed_page'||args.p_limit!==12)return original(name,args);
      if(args.p_cursor_rating_id)return{data:{items:[],has_more:false,next_cursor:null},error:null};
      const result=await original(name,args);
      return{...result,data:{...result.data,has_more:true,next_cursor:{created_at:'2026-08-09T11:00:00Z',rating_id:502,score:0}}};
    };
    await FBZFeed.load();
  });
  await page.getByRole('button',{name:'Показать ещё',exact:true}).click();
  await expect(page.locator('#feedMore')).toBeEmpty();
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await expect(page.locator('.feed-empty')).toHaveCount(0);
  await expect(page.locator('#feedMeta')).toContainText('2');
});

test('закрытие обсуждения не позволяет поздней ошибке открыть его снова',async({page})=>{
  await page.goto('/feed?__e2e=1');
  await expect(page.locator('.feed-entry')).toHaveCount(2);
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>name==='get_rating_comments'?new Promise(resolve=>{window.__resolveSocialComments=resolve;}):original(name,args);
  });
  const toggle=page.locator('[data-rating-id="501"]').getByRole('button',{name:'Обсудить оценку'});
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
  await page.evaluate(()=>window.__resolveSocialComments({data:null,error:{message:'offline'}}));
  await expect(page.locator('#feed-comments-501')).toBeEmpty();
});

test('Escape отменяет открытие личного чата и позднюю Realtime-подписку',async({page})=>{
  await prepareChat(page);
  await page.evaluate(friendId=>{
    const original=sb.rpc.bind(sb);
    window.__socialSubscriptions=0;
    sb.channel=()=>({on(){return this;},subscribe(){window.__socialSubscriptions++;return this;}});
    sb.rpc=(name,args)=>name==='get_direct_messages'?new Promise(resolve=>{window.__resolveSocialMessages=resolve;}):original(name,args);
    void FBZMessages.openFriend(friendId);
  },NATASHA);
  await expect.poll(()=>page.evaluate(()=>typeof window.__resolveSocialMessages)).toBe('function');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.__resolveSocialMessages({data:{items:[],has_more:false},error:null}));
  await expect(page.locator('#directChatOv')).toBeHidden();
  await expect(page.locator('#directChatBody')).toBeEmpty();
  expect(await page.evaluate(()=>window.__socialSubscriptions)).toBe(0);
});

test('повторный Enter отправляет сообщение один раз и сохраняет следующий черновик',async({page})=>{
  await prepareChat(page);await openChat(page);
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);
    window.__socialSendCount=0;
    sb.rpc=(name,args)=>name==='send_direct_message'?new Promise(resolve=>{
      window.__socialSendCount++;
      window.__finishSocialSend=async()=>resolve(await original(name,args));
    }):original(name,args);
  });
  const input=page.locator('#directChatInput');
  await input.fill('Первое сообщение');await input.press('Enter');await input.press('Enter');
  await expect(page.locator('#directChatSend')).toBeDisabled();
  expect(await page.evaluate(()=>window.__socialSendCount)).toBe(1);
  await input.fill('Следующее сообщение');
  await page.evaluate(()=>window.__finishSocialSend());
  await expect(page.locator('.dm-message')).toContainText('Первое сообщение');
  await expect(input).toHaveValue('Следующее сообщение');
  await expect(page.locator('#directChatSend')).toBeEnabled();
});

test('черновики и поздние ответы изолированы между личными чатами',async({page})=>{
  await prepareChat(page);await openChat(page);
  await page.locator('#directChatInput').fill('Только для Наташи');
  await page.evaluate(({gamlet})=>{
    const original=sb.rpc.bind(sb);
    sb.rpc=(name,args)=>{
      if(name==='get_or_create_direct_conversation'&&args.p_friend_id===gamlet)return Promise.resolve({data:{id:1001},error:null});
      return original(name,args);
    };
  },{gamlet:GAMLET});
  await page.evaluate(friendId=>FBZMessages.openFriend(friendId),GAMLET);
  await expect(page.locator('#directChatTitle')).toHaveText('Gamlet');
  await expect(page.locator('#directChatInput')).toHaveValue('');
  await page.locator('#directChatInput').fill('Только для Гамлета');
  await page.evaluate(friendId=>FBZMessages.openFriend(friendId),NATASHA);
  await expect(page.locator('#directChatInput')).toHaveValue('Только для Наташи');
  await page.evaluate(()=>FBZMessages.resetSession());
  await openChat(page);
  await expect(page.locator('#directChatInput')).toHaveValue('');
});

for(const closeWith of ['Escape','button']){
  test(`закрытие чата (${closeWith}) останавливает микрофон без отправки записи`,async({page})=>{
    await prepareChat(page);await openChat(page);
    await page.evaluate(()=>{
      window.__socialTrackStops=0;window.__socialVoiceSends=0;
      Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){window.__socialTrackStops++;}}]})}});
      window.MediaRecorder=class{
        static isTypeSupported(){return true;}
        constructor(){this.state='inactive';this.mimeType='audio/webm';}
        start(){this.state='recording';}
        stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob([new Uint8Array(2001)],{type:'audio/webm'})});this.onstop?.();});}
      };
      const original=sb.rpc.bind(sb);
      sb.rpc=(name,args)=>{if(name==='send_direct_message')window.__socialVoiceSends++;return original(name,args);};
    });
    await page.getByRole('button',{name:'Записать голосовое сообщение'}).click();
    await expect(page.locator('#directChatVoice')).toHaveAttribute('aria-pressed','true');
    if(closeWith==='Escape')await page.keyboard.press('Escape');
    else await page.locator('#directChatOv').getByRole('button',{name:'Закрыть',exact:true}).click();
    await expect(page.locator('#directChatOv')).toBeHidden();
    expect(await page.evaluate(()=>window.__socialTrackStops)).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.__socialVoiceSends)).toBe(0);
    expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.storage())).toBeNull();
  });
}

for(const viewport of [{width:360,height:800},{width:390,height:844},{width:1440,height:1000}]){
  test(`история и редактор личного сообщения помещаются в ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);await prepareChat(page);
    await page.evaluate(()=>{
      const original=sb.rpc.bind(sb);
      window.__socialHistoryCursors=[];
      sb.rpc=(name,args)=>{
        if(name!=='get_direct_messages')return original(name,args);
        window.__socialHistoryCursors.push(args.p_before_id);
        const id=args.p_before_id?1:2;
        return Promise.resolve({data:{items:[{id,conversation_id:1000,sender_id:CU.id,body:id===1?'Раннее сообщение':'Текст для редактирования',created_at:'2026-08-09T12:00:00Z',can_edit:true,sender:{username:'ОченьДлинноеИмяБолельщикаБезПробелов'.repeat(2)}}],has_more:id===2,next_before_id:id},error:null});
      };
    });
    await openChat(page);
    await page.getByRole('button',{name:'Более ранние сообщения'}).click();
    await expect(page.locator('.dm-message')).toHaveCount(2);
    await expect(page.getByRole('button',{name:'Более ранние сообщения'})).toHaveCount(0);
    expect(await page.evaluate(()=>window.__socialHistoryCursors)).toEqual([null,2]);
    await page.locator('.dm-message').last().getByRole('button',{name:'Изменить',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Изменить сообщение'})).toBeFocused();
    await expect(page.getByRole('button',{name:'Сохранить',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    expect(await page.locator('#directChatBody').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await page.getByRole('button',{name:'Отмена',exact:true}).click();
    await expect(page.locator('.dm-edit-form')).toHaveCount(0);
  });
}
