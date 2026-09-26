import {expect,test} from '@playwright/test';
import axe from 'axe-core';
import {installSupabaseMock} from './mock-supabase.mjs';

const own='3615141a-7700-46b8-9ba5-e4f4450537fc';
const other='cd291181-2db6-42cb-9f3d-ef84ab3a9660';
const errors=new WeakMap();
test.beforeEach(async({page})=>{
  const list=[];errors.set(page,list);page.on('pageerror',error=>list.push(error.message));
  await installSupabaseMock(page);
});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

async function accessible(page,selector){
  await page.addScriptTag({content:axe.source});
  const violations=await page.evaluate(async selector=>{
    const result=await window.axe.run(document.querySelector(selector),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
    return result.violations.filter(item=>['serious','critical'].includes(item.impact)).map(item=>({id:item.id,targets:item.nodes.map(node=>node.target)}));
  },selector);
  expect(violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

for(const {width,theme} of [{width:320,theme:'dark'},{width:390,theme:'light'},{width:768,theme:'dark'},{width:1440,theme:'light'}]){
  test(`друзья, уведомления и профиль доступны при ${width}px в теме ${theme}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height:width<900?844:1000});
    await page.addInitScript(theme=>localStorage.setItem('fbz_appearance',JSON.stringify({theme,accent:'emerald'})),theme);
    await page.goto('/friends?__e2e=1');
    await page.getByRole('button',{name:/Входящие/}).click();
    await expect(page.locator('.friend-card')).toContainText('natasha');
    await accessible(page,'#page-friends');
    await page.screenshot({path:testInfo.outputPath('friends.png'),fullPage:true});
    await page.locator('#notifBtn').click();
    await expect(page.locator('#notifPanel')).toBeVisible();
    await accessible(page,'#notifPanel');
    await page.screenshot({path:testInfo.outputPath('notifications.png')});
    await page.keyboard.press('Escape');
    await expect(page.locator('#notifBtn')).toBeFocused();
    await page.evaluate(()=>goOwnProfile());
    await page.locator('button[onclick="editProfile()"]').click();
    await expect(page.getByRole('textbox',{name:'Никнейм'})).toBeFocused();
    await accessible(page,'#profileW');
    await page.screenshot({path:testInfo.outputPath('profile-editor.png'),fullPage:true});
  });
}

test('ошибка друзей показывает повтор и сохраняет вкладку',async({page})=>{
  await page.goto('/friends?__e2e=1');
  await expect(page.locator('#friendsContent')).toHaveAttribute('aria-busy','false');
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);let fail=true;
    sb.from=table=>{
      const query=original(table);
      if(table==='friendships'&&fail){fail=false;query.then=resolve=>Promise.resolve({error:{message:'network_failure'}}).then(resolve);}
      return query;
    };
  });
  await page.getByRole('button',{name:/Входящие/}).click();
  await expect(page.locator('#friendsContent')).toContainText('Не удалось загрузить');
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('.friend-card')).toContainText('natasha');
  await expect(page.getByRole('button',{name:/Входящие/})).toHaveAttribute('aria-pressed','true');
});

test('поиск друзей передаёт подчёркивание как буквальный символ',async({page})=>{
  await page.goto('/friends?__e2e=1');
  await expect(page.locator('#friendsContent')).toHaveAttribute('aria-busy','false');
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);
    sb.from=table=>{const query=original(table);const ilike=query.ilike;query.ilike=(column,value)=>{window.searchPattern=value;return ilike(column,value);};return query;};
  });
  await page.locator('#friendSearch').fill('fan_name');
  await expect.poll(()=>page.evaluate(()=>window.searchPattern)).toBe('%fan\\_name%');
});

test('неудачная отметка уведомлений не сбрасывает счётчик; повтор сохраняется',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('#notifBadge')).toHaveText('2');
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);let fail=true;
    sb.from=table=>{
      const query=original(table),update=query.update;
      query.update=value=>{update(value);if(table==='notifications'&&fail){fail=false;query.then=resolve=>Promise.resolve({error:{message:'network_failure'}}).then(resolve);}return query;};
      return query;
    };
  });
  await page.locator('#notifBtn').click();
  await page.getByRole('button',{name:'Прочитать все'}).click();
  await expect(page.locator('#toast')).toContainText('Не удалось');
  await expect(page.locator('#notifBadge')).toHaveText('2');
  await expect(page.locator('#notifMarkAll')).toBeEnabled();
  await page.locator('#notifMarkAll').click();
  await expect(page.locator('#notifBadge')).toHaveText('0');
  await page.keyboard.press('Escape');
  await page.locator('#notifBtn').click();
  await expect(page.locator('#notifList')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.notif-item.unread')).toHaveCount(0);
});

test('ошибка сохранения профиля сохраняет введённое и допускает повтор',async({page})=>{
  await page.goto(`/profile/${own}?__e2e=1`);
  await page.locator('button[onclick="editProfile()"]').click();
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);let fail=true;
    sb.from=table=>{
      const query=original(table),update=query.update;
      query.update=value=>{update(value);if(table==='users'&&fail){fail=false;query.then=resolve=>Promise.resolve({error:{code:'23505',message:'private_database_constraint'}}).then(resolve);}return query;};
      return query;
    };
  });
  await page.getByRole('textbox',{name:'Никнейм'}).fill('new_bazed');
  await page.getByRole('textbox',{name:/О себе/}).fill('Новый футбольный сезон');
  await page.locator('#epSaveBtn').click();
  await expect(page.getByRole('alert')).toContainText('Этот никнейм уже занят');
  await expect(page.getByRole('textbox',{name:/О себе/})).toHaveValue('Новый футбольный сезон');
  await expect(page.locator('#epSaveBtn')).toBeEnabled();
  await page.locator('#epSaveBtn').click();
  await expect(page.getByRole('heading',{name:'new_bazed',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.profile().bio)).toBe('Новый футбольный сезон');
});

test('позднее сохранение профиля не возвращает пользователя с другого экрана',async({page})=>{
  await page.goto(`/profile/${own}?__e2e=1`);
  await page.locator('button[onclick="editProfile()"]').click();
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);window.profileWrites=0;
    sb.from=table=>{
      const query=original(table),update=query.update;
      query.update=value=>{update(value);if(table==='users'){window.profileWrites++;const then=query.then;query.then=(resolve,reject)=>new Promise(done=>{window.finishProfile=()=>done(then(result=>result));}).then(resolve,reject);}return query;};
      return query;
    };
  });
  await page.locator('#epSaveBtn').click();
  await expect(page.locator('#epSaveBtn')).toBeDisabled();
  await page.evaluate(()=>FBZProfileEditor.save());
  expect(await page.evaluate(()=>window.profileWrites)).toBe(1);
  await page.evaluate(()=>go('matches'));
  await page.evaluate(()=>window.finishProfile());
  await expect(page).toHaveURL(/\/matches\?__e2e=1$/u);
  await expect(page.locator('#page-matches')).toHaveClass(/on/u);
});

test('поздняя заявка из профиля не меняет другой профиль',async({page})=>{
  await page.goto(`/profile/${other}?__e2e=1`);
  await expect(page.locator('#profAddBtn')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);window.friendWrites=0;
    sb.rpc=(name,args)=>{if(name==='request_friendship'){window.friendWrites++;return new Promise(resolve=>{window.finishFriend=()=>resolve(original(name,args));});}return original(name,args);};
  });
  await page.locator('#profAddBtn').click();
  await expect(page.locator('#profAddBtn')).toBeDisabled();
  await page.evaluate(id=>addFriendFromProfile(id),other);
  expect(await page.evaluate(()=>window.friendWrites)).toBe(1);
  await page.evaluate(()=>goOwnProfile());
  await expect(page.getByRole('heading',{name:'Bazed',exact:true})).toBeVisible();
  await page.evaluate(()=>window.finishFriend());
  await expect(page).toHaveURL(new RegExp(`/profile/${own}\\?__e2e=1$`,'u'));
  await expect(page.getByRole('heading',{name:'Bazed',exact:true})).toBeVisible();
});

test('выход очищает уведомления и отбрасывает позднюю загрузку',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('.notif-item')).toHaveCount(2);
  await page.evaluate(()=>{
    const original=sb.from.bind(sb);window.notificationReleases=[];
    sb.from=table=>{const query=original(table);if(table==='notifications'){const then=query.then;query.then=(resolve,reject)=>new Promise(done=>{window.notificationReleases.push(()=>done(then(result=>result)));}).then(resolve,reject);}return query;};
    window.pendingNotifications=loadNotifications();
  });
  await expect.poll(()=>page.evaluate(()=>window.notificationReleases.length)).toBe(2);
  await page.evaluate(()=>window.__FOOTBAZED_TEST_AUTH__.emit('SIGNED_OUT',null));
  await page.evaluate(async()=>{window.notificationReleases.forEach(release=>release());await window.pendingNotifications;});
  await expect(page.locator('.notif-item')).toHaveCount(0);
  await expect(page.locator('#notifPanel')).toBeHidden();
  await expect(page.locator('#accountBtn')).toHaveCount(0);
});

test('счётчик уведомлений учитывает записи вне последних двадцати',async({page})=>{
  await page.goto('/?__e2e=1');
  await expect(page.locator('#notifBadge')).toHaveText('2');
  await page.evaluate(async()=>{
    const original=sb.from.bind(sb);
    sb.from=table=>{
      const query=original(table),select=query.select;
      query.select=(fields,options)=>{select(fields,options);if(table==='notifications'&&options?.head)query.then=resolve=>Promise.resolve({count:25,data:null,error:null}).then(resolve);return query;};
      return query;
    };
    await loadNotifications();
  });
  await expect(page.locator('#notifBadge')).toHaveText('25');
  await expect(page.locator('.notif-item')).toHaveCount(2);
});

test('обсуждение матча повторяет загрузку, блокирует двойную отправку и редактирует текст',async({page})=>{
  await page.goto('/match/101?__e2e=1');
  await expect(page.locator('.md-hero')).toBeVisible();
  await page.evaluate(()=>{
    const original=sb.rpc.bind(sb);let fail=true;
    const messages=[{id:990,user_id:CU.id,message:'Исходное сообщение',created_at:'2026-09-24T12:00:00Z',user:{username:'bazed'},can_edit:true}];
    window.chatWrites=0;
    sb.rpc=(name,args)=>{
      if(name==='get_match_chat_messages'){if(fail){fail=false;return Promise.resolve({error:{message:'offline'}});}return Promise.resolve({data:messages,error:null});}
      if(name==='send_match_chat_message'){window.chatWrites++;return new Promise(resolve=>{window.finishChat=()=>{messages.push({...messages[0],id:991,message:args.p_message});resolve({error:null});};});}
      if(name==='edit_match_chat_message'){const message=messages.find(row=>row.id===args.p_message_id);message.message=args.p_message;message.edited_at=new Date().toISOString();return Promise.resolve({error:null});}
      return original(name,args);
    };
    go('chat',{mid:101,title:'Real Madrid — Manchester City'});
  });
  await expect(page.locator('#chatBody')).toContainText('Не удалось загрузить');
  await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.locator('.cmsg')).toHaveCount(1);
  await page.locator('#chatI').fill('Новый комментарий');
  await page.locator('#chatS').click();
  await page.locator('#chatI').press('Enter');
  expect(await page.evaluate(()=>window.chatWrites)).toBe(1);
  await page.locator('#chatI').fill('Следующий черновик');
  await page.evaluate(()=>window.finishChat());
  await expect(page.locator('.cmsg')).toHaveCount(2);
  await expect(page.locator('#chatI')).toHaveValue('Следующий черновик');
  await page.locator('.cmsg').last().getByRole('button',{name:'Изменить'}).click();
  await page.getByRole('textbox',{name:'Изменить сообщение'}).fill('Исправленный комментарий');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.locator('.cmsg').last()).toContainText('Исправленный комментарий');
  await expect(page.locator('.cmsg').last()).toContainText('ред.');
});
