const fixture={
  sessionUser:{id:'3615141a-7700-46b8-9ba5-e4f4450537fc',email:'bazed@example.test'},
  profile:{
    id:'3615141a-7700-46b8-9ba5-e4f4450537fc',username:'bazed',display_name:'Bazed',avatar_url:null,
    bio:'Смотрю футбол внимательно.',favorite_teams:null,ratings_count:11,avg_rating:7.8,
    streak:1,streak_date:'2026-08-09',is_public:true,created_at:'2026-04-02T10:00:00Z',is_admin:true
  },
  users:[
    {id:'3615141a-7700-46b8-9ba5-e4f4450537fc',username:'bazed',display_name:'Bazed',avatar_url:null,is_public:true,ratings_count:11,avg_rating:7.8},
    {id:'cd291181-2db6-42cb-9f3d-ef84ab3a9660',username:'gamlet',display_name:'Gamlet',avatar_url:null,is_public:true,ratings_count:8,avg_rating:8.1},
    {id:'2b854020-9701-4f49-9c36-2b65c9dcd449',username:'natasha',display_name:'Natasha',avatar_url:null,is_public:true,ratings_count:5,avg_rating:7.4}
  ],
  friendships:[
    {id:801,user_id:'2b854020-9701-4f49-9c36-2b65c9dcd449',friend_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',status:'pending',created_at:'2026-08-09T13:00:00Z'}
  ],
  notifications:[
    {id:901,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',from_user_id:'2b854020-9701-4f49-9c36-2b65c9dcd449',type:'friend_request',message:'Natasha хочет добавить вас в друзья',read:false,created_at:'2026-08-09T13:00:00Z',rating_id:null,comment_id:null},
    {id:902,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',from_user_id:'cd291181-2db6-42cb-9f3d-ef84ab3a9660',type:'like',message:'Gamlet оценил вашу публикацию',read:false,created_at:'2026-08-09T13:05:00Z',rating_id:501,comment_id:null}
  ],
  players:[
    {id:5290,name:'Thibaut Courtois',team:'Real Madrid CF',club_id:24,position:'GK',shirt_number:1},
    {id:5291,name:'Antonio Rüdiger',team:'Real Madrid CF',club_id:24,position:'CB',shirt_number:22},
    {id:5292,name:'Jude Bellingham',team:'Real Madrid CF',club_id:24,position:'AM',shirt_number:5},
    {id:5293,name:'Dani Carvajal',team:'Real Madrid CF',club_id:24,position:'RB',shirt_number:2},
    {id:5294,name:'Aurélien Tchouaméni',team:'Real Madrid CF',club_id:24,position:'DM',shirt_number:14},
    {id:5295,name:'Vinícius Júnior',team:'Real Madrid CF',club_id:24,position:'LW',shirt_number:7},
    {id:6201,name:'Ederson',team:'Manchester City FC',club_id:31,position:'GK',shirt_number:31},
    {id:6202,name:'Rúben Dias',team:'Manchester City FC',club_id:31,position:'CB',shirt_number:3},
    {id:6203,name:'Joško Gvardiol',team:'Manchester City FC',club_id:31,position:'LB',shirt_number:24},
    {id:6204,name:'Rodri',team:'Manchester City FC',club_id:31,position:'DM',shirt_number:16},
    {id:6205,name:'Phil Foden',team:'Manchester City FC',club_id:31,position:'AM',shirt_number:47},
    {id:6206,name:'Erling Haaland',team:'Manchester City FC',club_id:31,position:'ST',shirt_number:9}
  ],
  playerRatings:[
    {user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',match_id:101,player_id:5290,rating:9,is_best_player:true},
    {user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',match_id:101,player_id:5292,rating:8,is_best_player:false}
  ],
  matches:[
    {id:101,competition_id:7,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',status:'finished',home_score:2,away_score:1,external_id:9101,league_code:'CL',matchday:1,season:'2026'},
    {id:102,competition_id:8,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',home_club_id:24,away_club_id:25,match_date:'2026-08-20T19:00:00Z',status:'scheduled',home_score:null,away_score:null,external_id:9102,league_code:'PD',matchday:2,season:'2026'}
  ],
  feed:[
    {rating_id:501,user_id:'cd291181-2db6-42cb-9f3d-ef84ab3a9660',match_id:101,match_rating:10,comment:'Сильный второй тайм и отличный контроль центра поля.',created_at:'2026-08-09T12:00:00Z',updated_at:'2026-08-09T12:00:00Z',user:{username:'gamlet',display_name:'Gamlet',avatar_url:null},match:{league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1},like_count:3,comment_count:61,liked_by_me:false,player_highlights:[{player_id:5290,name:'Thibaut Courtois',club_id:24,team:'Real Madrid CF',rating:8.7,is_best_player:true}]},
    {rating_id:502,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',match_id:101,match_rating:8,comment:'Матч решил темп после перерыва.',created_at:'2026-08-09T11:00:00Z',updated_at:'2026-08-09T11:00:00Z',user:{username:'bazed',display_name:'Bazed',avatar_url:null},match:{league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1},like_count:1,comment_count:0,liked_by_me:false,player_highlights:[]}
  ],
  comments:{
    501:[{id:701,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',comment:'Согласен насчёт второго тайма.',created_at:'2026-08-09T12:10:00Z',can_delete:true,user:{username:'bazed',display_name:'Bazed',avatar_url:null}}]
  },
  club:{
    club:{id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',media:null,primary_color:'#274C77',secondary_color:'#E7ECEF',area_name:'Spain',venue:'Santiago Bernabéu',founded:1902,club_colors:'White / Purple'},
    is_favorite:true,favorite_count:1,
    competitions:[{id:7,name:'Champions League',code:'CL'},{id:8,name:'La Liga',code:'PD'}],
    stats:{squad_count:3,match_count:2,upcoming_count:1,player_rating:8.4,player_rating_count:6},
    squad:[
      {id:5290,name:'Thibaut Courtois',position:'GK',shirt_number:1,media:null,average:8.7,rating_count:3,best_votes:2},
      {id:5291,name:'Antonio Rüdiger',position:'CB',shirt_number:22,media:null,average:8.2,rating_count:2,best_votes:0},
      {id:5292,name:'Jude Bellingham',position:'AM',shirt_number:5,media:null,average:8.4,rating_count:1,best_votes:1}
    ],
    matches:[]
  },
  player:{
    player:{id:5290,name:'Thibaut Courtois',position:'GK',shirt_number:1,media:null,team:'Real Madrid CF',club:{id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',media:null,primary_color:'#274C77',secondary_color:'#E7ECEF'}},
    stats:{average:8.7,rating_count:3,best_votes:2,matches_rated:1},
    performances:[{match_id:101,average:8.7,rating_count:3,best_votes:2,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1}],
    teammates:[{id:5291,name:'Antonio Rüdiger',position:'CB',shirt_number:22,media:null},{id:5292,name:'Jude Bellingham',position:'AM',shirt_number:5,media:null}]
  },
  competition:{
    competition:{id:7,name:'Champions League',short_name:'Champions League',code:'CL',area_name:'Europe',competition_type:'CUP',media:null},
    stats:{club_count:2,match_count:1,finished_count:1,upcoming_count:0},
    clubs:[
      {id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',media:null,primary_color:'#274C77',secondary_color:'#E7ECEF'},
      {id:31,name:'Manchester City FC',short_name:'Man City',tla:'MCI',media:null,primary_color:'#6CABDD',secondary_color:'#1C2C5B'}
    ],
    matches:[]
  },
  favoriteClubs:[{id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',media:null,primary_color:'#274C77',secondary_color:'#E7ECEF',favorited_at:'2026-08-01T10:00:00Z'}]
};

export async function installSupabaseMock(page,overrides={}){
  await page.addInitScript(data=>{
    localStorage.setItem('fbz_session_hint','1');
    const state=structuredClone(data);
    state.club.matches=structuredClone(state.matches);
    state.competition.matches=structuredClone(state.matches.filter(match=>match.competition_id===7));
    state.directConversations=[];
    state.directMessages=[];
    let nextCommentId=900;
    let nextFriendshipId=900;
    let nextConversationId=1000;
    let nextDirectMessageId=2000;
    let authListener=null;

    function promiseResult(data,error=null,count=null){
      const result=Promise.resolve({data,error,count});
      result.maybeSingle=()=>result;
      result.single=()=>result;
      return result;
    }

    function rpc(name,args={}){
      if(name==='get_match_lineup'){
        if(state.lineupError)return promiseResult(null,{message:'lineup temporarily unavailable'});
        if(Object.hasOwn(state,'lineup'))return promiseResult(structuredClone(state.lineup));
        // Declared participation is a test fixture, independent of current club membership.
        const homeIds=[5290,5291,5292,5293,5294,5295],awayIds=[6201,6202,6203,6204,6205,6206];
        const makeSide=(ids,clubId)=>[...ids.map((playerId,i)=>({...structuredClone(state.players.find(p=>p.id===playerId)),
          id:playerId,club_id:clubId,provider_player_id:playerId,eligible:true,participation:'starter',grid:['1:1','2:1','3:1','2:2','3:2','4:1'][i],
          minutes_played:90,goals:i===5?1:0,assists:0,yellow_cards:0,red_cards:0})),
          ...['2:3','2:4','3:3','4:2','4:3'].map((grid,i)=>({id:null,provider_player_id:clubId*1000+i,club_id:clubId,
            name:`Fixture Starter ${i+7}`,participation:'starter',position:grid.startsWith('2')?'D':grid.startsWith('3')?'M':'F',grid,eligible:false,minutes_played:90}))];
        return promiseResult({available:true,provider:'api-football',home:{club_id:24,formation:'4-3-3'},away:{club_id:31,formation:'4-3-3'},
          players:[...makeSide(homeIds,24),...makeSide(awayIds,31)]});
      }
      if(name==='get_profile_diary'){
        const f=args.p_filters||{},cursor=args.p_cursor,limit=args.p_limit||8;
        const visible=state.diary||state.feed.filter(r=>r.user_id===args.p_user_id).map(r=>({...state.matches.find(m=>m.id===r.match_id),...r.match,id:r.rating_id,user_id:r.user_id,match_id:r.match_id,match_rating:r.match_rating,is_public:true,created_at:r.created_at}));
        const dateKey=f.v==='2'?'match_date':'created_at';
        const filtered=visible.filter(r=>(!f.query||`${r.home_team_name} ${r.away_team_name}`.toLowerCase().includes(f.query.toLowerCase()))&&(!f.competition_id||r.competition_id===Number(f.competition_id))&&(!f.club_id||[r.home_club_id,r.away_club_id].includes(Number(f.club_id)))&&(!f.league||r.league_name===f.league)&&(!f.team||[r.home_team_name,r.away_team_name].includes(f.team))&&(!f.from||r.match_date.slice(0,10)>=f.from)&&(!f.to||r.match_date.slice(0,10)<=f.to)&&(!f.min_rating||r.match_rating>=Number(f.min_rating))&&(!f.max_rating||r.match_rating<=Number(f.max_rating))&&(!f.home_score||r.home_score===Number(f.home_score))&&(!f.away_score||r.away_score===Number(f.away_score))).sort((a,b)=>b[dateKey].localeCompare(a[dateKey])||b.id-a.id);
        const remaining=filtered.filter(r=>!cursor||r[dateKey]<cursor[dateKey]||r[dateKey]===cursor[dateKey]&&r.id<cursor.id),items=remaining.slice(0,limit),last=items.at(-1);
        const months=[...new Set(items.map(r=>r.match_date.slice(0,7)))].map(month=>{const rows=filtered.filter(r=>r.match_date.startsWith(month));return{month,matches:rows.length,average:rows.reduce((sum,r)=>sum+r.match_rating,0)/rows.length};});
        const competitions=[...new Map(visible.filter(r=>r.competition_id).map(r=>[r.competition_id,{id:r.competition_id,name:r.league_name}])).values()];
        const clubs=[...new Set(visible.flatMap(r=>[r.home_club_id,r.away_club_id]).filter(Boolean))].map(id=>{const rows=visible.filter(r=>[r.home_club_id,r.away_club_id].includes(id)),r=rows[0];return{id,name:r.home_club_id===id?r.home_team_name:r.away_team_name,competition_ids:[...new Set(rows.map(r=>r.competition_id))]};});
        return promiseResult({items,total:filtered.length,has_more:remaining.length>limit,next_cursor:last?{[dateKey]:last[dateKey],id:last.id}:null,months,competitions,clubs});
      }
      if(name==='get_football_statistics'){
        const f=args.p_filters||{},kind=args.p_kind||'matches',offset=args.p_offset||0,limit=args.p_limit||12;
        const catalogue=state.matches;
        const base=state.feed.map(r=>({...r,match:{...catalogue.find(m=>m.id===r.match_id),...r.match}})).filter(r=>(!f.competition_id||r.match.competition_id===Number(f.competition_id))&&(!f.club_id||[r.match.home_club_id,r.match.away_club_id].includes(Number(f.club_id)))&&(!f.league||r.match.league_name===f.league)&&(!f.team||[r.match.home_team_name,r.match.away_team_name].includes(f.team))&&(!f.from||r.match.match_date.slice(0,10)>=f.from)&&(!f.to||r.match.match_date.slice(0,10)<=f.to));
        const groups=new Map();
        const add=(id,title,subtitle,r,score=r.match_rating)=>{const key=String(id),g=groups.get(key)||{...r.match,entity_key:key,entity_id:id,title,subtitle,scores:[],people:new Set(),latest:r.match.match_date,home_score:r.match.home_score,away_score:r.match.away_score};g.scores.push(score);g.people.add(r.user_id);groups.set(key,g);};
        for(const r of base){const m=r.match;
          if(kind==='matches')add(r.match_id,`${m.home_team_name} — ${m.away_team_name}`,m.league_name,r);
          if(kind==='leagues')add(7,m.league_name,'Турнир',r);
          if(kind==='clubs'){add(m.home_club_id,m.home_team_name,'Матчи клуба',r);add(m.away_club_id,m.away_team_name,'Матчи клуба',r);}
          if(kind==='players')for(const pr of state.playerRatings.filter(p=>p.match_id===r.match_id&&p.user_id===r.user_id)){const p=state.players.find(p=>p.id===pr.player_id);add(p.id,p.name,p.team,r,pr.rating);}
        }
        const rows=[...groups.values()].map(g=>({...g,average:g.scores.reduce((a,b)=>a+b,0)/g.scores.length,votes:g.scores.length,voters:g.people.size})).filter(g=>g.votes>=Number(f.min_votes||1)&&(!f.query||`${g.title} ${g.subtitle}`.toLowerCase().includes(f.query.toLowerCase()))).sort((a,b)=>f.sort==='votes'?b.votes-a.votes:b.average-a.average).map((g,i)=>({...g,rank:i+1}));
        const competitions=[...new Map(catalogue.map(m=>[m.competition_id,{id:m.competition_id,name:m.league_name}])).values()];
        const clubs=[...new Set(catalogue.flatMap(m=>[m.home_club_id,m.away_club_id]))].map(id=>{const matches=catalogue.filter(m=>[m.home_club_id,m.away_club_id].includes(id)),m=matches[0];return{id,name:m.home_club_id===id?m.home_team_name:m.away_team_name,competition_ids:[...new Set(matches.map(m=>m.competition_id))]};});
        return promiseResult({items:rows.slice(offset,offset+limit),total:rows.length,has_more:rows.length>offset+limit,next_offset:offset+limit,summary:{votes:base.length,matches:new Set(base.map(r=>r.match_id)).size,voters:new Set(base.map(r=>r.user_id)).size},competitions,clubs});
      }
      if(name==='get_my_profile')return promiseResult(structuredClone(state.profile));
      if(name==='save_match_rating'){
        state.lastRatingPayload=structuredClone(args);
        state.playerRatings=(args.p_player_ratings||[]).map(item=>({user_id:state.sessionUser.id,match_id:Number(args.p_match_id),...structuredClone(item)}));
        return promiseResult({ratings_count:state.profile.ratings_count,avg_rating:state.profile.avg_rating,streak:state.profile.streak,streak_date:state.profile.streak_date});
      }
      if(name==='delete_match_rating')return promiseResult({ratings_count:Math.max(0,state.profile.ratings_count-1),avg_rating:state.profile.avg_rating,streak:state.profile.streak,streak_date:state.profile.streak_date});
      if(name==='get_my_favorite_clubs')return promiseResult(structuredClone(state.favoriteClubs));
      if(name==='set_favorite_club'){
        const clubId=Number(args.p_club_id);
        const favorite=Boolean(args.p_favorite);
        const existing=state.favoriteClubs.some(club=>Number(club.id)===clubId);
        if(favorite&&!existing)state.favoriteClubs.push({...structuredClone(state.club.club),favorited_at:new Date().toISOString()});
        if(!favorite&&existing)state.favoriteClubs=state.favoriteClubs.filter(club=>Number(club.id)!==clubId);
        state.club.is_favorite=favorite;
        state.club.favorite_count=state.favoriteClubs.some(club=>Number(club.id)===clubId)?1:0;
        return promiseResult({club_id:clubId,is_favorite:favorite,changed:favorite!==existing,favorite_count:state.club.favorite_count});
      }
      if(name==='get_profile_page'){
        const userId=String(args.p_user_id||'');
        const profile=state.users.find(user=>user.id===userId);
        if(!profile)return promiseResult(null);
        const ratings=state.feed.filter(item=>item.user_id===userId).map(item=>({
          id:item.rating_id,user_id:item.user_id,match_id:item.match_id,match_rating:item.match_rating,
          comment:item.comment,is_public:true,created_at:item.created_at,match:{id:item.match_id,...item.match}
        }));
        const friendship=state.friendships
          .filter(item=>(item.user_id===state.sessionUser.id&&item.friend_id===userId)||(item.friend_id===state.sessionUser.id&&item.user_id===userId))
          .sort((a,b)=>(a.status==='accepted'?-1:0)-(b.status==='accepted'?-1:0))[0];
        const friendIds=new Set(state.friendships.filter(item=>item.status==='accepted'&&(item.user_id===userId||item.friend_id===userId)).map(item=>item.user_id===userId?item.friend_id:item.user_id));
        return promiseResult({
          profile:{...structuredClone(profile),bio:userId===state.profile.id?state.profile.bio:null,favorite_teams:null,streak:userId===state.profile.id?state.profile.streak:0,created_at:state.profile.created_at,invite_code:userId===state.profile.id?'TESTCODE':null},
          favorite_clubs:userId===state.profile.id?structuredClone(state.favoriteClubs):[],
          stats:{friend_count:friendIds.size,like_count:state.feed.filter(item=>item.user_id===userId).reduce((sum,item)=>sum+item.like_count,0)},
          friendship:friendship?{status:friendship.status,direction:friendship.user_id===state.sessionUser.id?'outgoing':'incoming'}:null,
          ratings
        });
      }
      if(name==='get_leaderboard'){
        const users=state.users.map(user=>({
          ...structuredClone(user),
          tl:state.feed.filter(item=>item.user_id===user.id).reduce((sum,item)=>sum+item.like_count,0),
          rc:user.ratings_count||0
        }));
        users.sort((a,b)=>args.p_metric==='ratings'?b.rc-a.rc:b.tl-a.tl||b.rc-a.rc);
        return promiseResult(users.slice(0,Number(args.p_limit)||50));
      }
      if(name==='get_matches_page'){
        const status=String(args.p_status||'all');
        const league=String(args.p_league||'all');
        const query=String(args.p_query||'').toLocaleLowerCase();
        const offset=Math.max(Number(args.p_offset)||0,0);
        const limit=Math.min(Math.max(Number(args.p_limit)||24,1),48);
        const leagues=[...new Set(state.matches.map(match=>match.league_name))].sort();
        const items=state.matches.filter(match=>(status==='all'||match.status===status)
          &&(league==='all'||match.league_name===league)
          &&(!query||`${match.home_team_name} ${match.away_team_name} ${match.league_name}`.toLocaleLowerCase().includes(query)));
        const pageItems=items.slice(offset,offset+limit);
        return promiseResult({
          items:structuredClone(pageItems),
          total:items.length,
          has_more:offset+pageItems.length<items.length,
          next_offset:offset+pageItems.length,
          leagues
        });
      }
      if(name==='request_friendship'){
        const otherId=String(args.p_friend_id||'');
        const currentId=state.sessionUser.id;
        const accepted=state.friendships.some(item=>item.status==='accepted'&&((item.user_id===currentId&&item.friend_id===otherId)||(item.user_id===otherId&&item.friend_id===currentId)));
        if(accepted)return promiseResult({status:'accepted',changed:false});
        const ownPending=state.friendships.some(item=>item.user_id===currentId&&item.friend_id===otherId&&item.status==='pending');
        if(ownPending)return promiseResult({status:'pending',changed:false});
        const incoming=state.friendships.find(item=>item.user_id===otherId&&item.friend_id===currentId&&item.status==='pending');
        if(incoming){
          incoming.status='accepted';
          state.friendships.push({id:nextFriendshipId++,user_id:currentId,friend_id:otherId,status:'accepted',created_at:new Date().toISOString()});
          return promiseResult({status:'accepted',changed:true});
        }
        state.friendships.push({id:nextFriendshipId++,user_id:currentId,friend_id:otherId,status:'pending',created_at:new Date().toISOString()});
        return promiseResult({status:'pending',changed:true});
      }
      if(name==='respond_friendship'){
        const requesterId=String(args.p_requester_id||'');
        const request=state.friendships.find(item=>item.user_id===requesterId&&item.friend_id===state.sessionUser.id&&item.status==='pending');
        if(!request)return promiseResult(null,{message:'friendship_request_not_found',code:'P0002'});
        if(args.p_action==='accept'){
          request.status='accepted';
          state.friendships.push({id:nextFriendshipId++,user_id:state.sessionUser.id,friend_id:requesterId,status:'accepted',created_at:new Date().toISOString()});
          return promiseResult({status:'accepted',changed:true});
        }
        state.friendships=state.friendships.filter(item=>item!==request);
        return promiseResult({status:'rejected',changed:true});
      }
      if(name==='remove_friendship'){
        const otherId=String(args.p_other_id||'');
        const before=state.friendships.length;
        state.friendships=state.friendships.filter(item=>!((item.user_id===state.sessionUser.id&&item.friend_id===otherId)||(item.user_id===otherId&&item.friend_id===state.sessionUser.id)));
        return promiseResult({status:'removed',changed:before!==state.friendships.length});
      }
      if(name==='get_or_create_direct_conversation'){
        const friendId=String(args.p_friend_id||'');
        const accepted=state.friendships.some(item=>item.status==='accepted'&&((item.user_id===state.sessionUser.id&&item.friend_id===friendId)||(item.user_id===friendId&&item.friend_id===state.sessionUser.id)));
        if(!accepted)return promiseResult(null,{message:'friendship_required',code:'42501'});
        let conversation=state.directConversations.find(item=>item.friendId===friendId);
        if(!conversation){conversation={id:nextConversationId++,friendId,created_at:new Date().toISOString(),last_message_at:null};state.directConversations.push(conversation);}
        return promiseResult(structuredClone(conversation));
      }
      if(name==='get_direct_messages'){
        const items=state.directMessages.filter(item=>Number(item.conversation_id)===Number(args.p_conversation_id));
        return promiseResult({items:structuredClone(items),has_more:false,next_before_id:items[0]?.id||null});
      }
      if(name==='send_direct_message'){
        const ratingItem=state.feed.find(item=>Number(item.rating_id)===Number(args.p_rating_id));
        const message={
          id:nextDirectMessageId++,conversation_id:Number(args.p_conversation_id),sender_id:state.sessionUser.id,
          body:args.p_body||null,media_kind:args.p_media_kind||null,media_path:args.p_media_path||null,rating_id:args.p_rating_id||null,
          created_at:new Date().toISOString(),updated_at:new Date().toISOString(),edited_at:null,can_edit:true,
          sender:{username:state.profile.username,display_name:state.profile.display_name,avatar_url:null},
          rating:ratingItem?{match_id:ratingItem.match_id,score:ratingItem.match_rating,supporter_side:ratingItem.supporter_side||'neutral',...structuredClone(ratingItem.match)}:null
        };
        state.directMessages.push(message);
        return promiseResult({id:message.id,created_at:message.created_at});
      }
      if(name==='edit_direct_message'){
        const message=state.directMessages.find(item=>Number(item.id)===Number(args.p_message_id)&&item.sender_id===state.sessionUser.id);
        if(!message)return promiseResult(null,{message:'message_not_found',code:'P0002'});
        message.body=String(args.p_body||'');message.updated_at=new Date().toISOString();message.edited_at=message.updated_at;
        return promiseResult({id:message.id,body:message.body,updated_at:message.updated_at,edited_at:message.edited_at});
      }
      if(name==='get_profile_comparison')return promiseResult({common_matches:1,agreement_score:89,average_gap:1,exact_matches:0,closest:[],contrasts:[]});
      if(name==='get_social_feed_page'||name==='get_social_feed'){
        let items=structuredClone(state.feed);
        if(args.p_scope==='mine')items=items.filter(item=>item.user_id===state.sessionUser.id);
        if(args.p_scope==='friends')items=items.filter(item=>item.user_id!==state.sessionUser.id);
        const score=item=>Number(item.like_count||0)*3+Number(item.comment_count||0)*2+(item.comment?1:0);
        items.sort((a,b)=>args.p_scope==='popular'
          ?score(b)-score(a)||String(b.created_at).localeCompare(String(a.created_at))||Number(b.rating_id)-Number(a.rating_id)
          :String(b.created_at).localeCompare(String(a.created_at))||Number(b.rating_id)-Number(a.rating_id));
        if(name==='get_social_feed_page'&&args.p_cursor_created_at){
          items=items.filter(item=>args.p_scope==='popular'
            ?score(item)<Number(args.p_cursor_score)
              ||(score(item)===Number(args.p_cursor_score)&&String(item.created_at)<String(args.p_cursor_created_at))
              ||(score(item)===Number(args.p_cursor_score)&&String(item.created_at)===String(args.p_cursor_created_at)&&Number(item.rating_id)<Number(args.p_cursor_rating_id))
            :String(item.created_at)<String(args.p_cursor_created_at)
              ||(String(item.created_at)===String(args.p_cursor_created_at)&&Number(item.rating_id)<Number(args.p_cursor_rating_id)));
        }
        const offset=name==='get_social_feed'?Number(args.p_offset)||0:0;
        const limit=Number(args.p_limit)||12;
        const pageItems=items.slice(offset,offset+limit);
        const last=pageItems.at(-1);
        return promiseResult({
          items:pageItems,
          has_more:offset+limit<items.length,
          next_offset:offset+pageItems.length,
          next_cursor:last&&offset+limit<items.length?{created_at:last.created_at,rating_id:last.rating_id,score:score(last)}:null
        });
      }
      if(name==='get_rating_comments')return promiseResult(structuredClone(state.comments[args.p_rating_id]||[]));
      if(name==='toggle_rating_like'){
        const item=state.feed.find(entry=>entry.rating_id===Number(args.p_rating_id));
        item.liked_by_me=!item.liked_by_me;
        item.like_count=Math.max(0,item.like_count+(item.liked_by_me?1:-1));
        return promiseResult({liked:item.liked_by_me,like_count:item.like_count});
      }
      if(name==='add_rating_comment'){
        const id=Number(args.p_rating_id);
        const comment={id:nextCommentId++,user_id:state.sessionUser.id,comment:args.p_comment,created_at:new Date().toISOString(),can_delete:true,user:{username:state.profile.username,display_name:state.profile.display_name,avatar_url:null}};
        state.comments[id]=[...(state.comments[id]||[]),comment];
        const item=state.feed.find(entry=>entry.rating_id===id);
        if(item)item.comment_count=state.comments[id].length;
        return promiseResult(structuredClone(comment));
      }
      if(name==='delete_rating_comment'){
        for(const [ratingId,comments] of Object.entries(state.comments)){
          const next=comments.filter(comment=>comment.id!==Number(args.p_comment_id));
          if(next.length!==comments.length){state.comments[ratingId]=next;return promiseResult(true);}
        }
        return promiseResult(false);
      }
      if(name==='get_club_page')return promiseResult(Number(args.p_club_id)===24?structuredClone(state.club):null);
      if(name==='get_club_marks')return promiseResult((state.clubMarks||[]).filter(club=>args.p_ids.includes(Number(club.id))).map(club=>structuredClone(club)));
      if(name==='get_player_page')return promiseResult(Number(args.p_player_id)===5290?structuredClone(state.player):null);
      if(name==='get_competition_page')return promiseResult(Number(args.p_competition_id)===7?structuredClone(state.competition):null);
      if(name==='get_match_insights'){
        const distribution=Array.from({length:10},(_,index)=>({score:10-index,count:index===1?1:index===2?1:0}));
        return promiseResult({rating_count:2,average:8.5,distribution,segments:{all:{rating_count:2,average:8.5,distribution},home:{rating_count:1,average:9,distribution},away:{rating_count:0,average:null,distribution:[]},neutral:{rating_count:1,average:8,distribution}},top_players:[{player_id:5290,name:'Thibaut Courtois',team:'Real Madrid CF',average:8.7,rating_count:3,best_votes:2}]});
      }
      if(name==='search_footbazed'){
        const query=String(args.p_query||'').toLocaleLowerCase();
        const results=[];
        if('champions league'.includes(query)||query.includes('champions'))results.push({entity_type:'competition',entity_id:'7',title:'Champions League',subtitle:'Europe',meta:'CL',relevance:0.99});
        if('real madrid cf'.includes(query)||query.includes('madrid'))results.push({entity_type:'club',entity_id:'24',title:'Real Madrid CF',subtitle:'Spain',meta:'RMA',relevance:0.98});
        return promiseResult(results.slice(0,Number(args.p_limit)||14));
      }
      return promiseResult(null);
    }

    function rowsFor(table){
      if(table==='users')return structuredClone(state.users);
      if(table==='matches')return structuredClone(state.matches);
      if(table==='ratings')return state.feed.map(item=>({id:item.rating_id,user_id:item.user_id,match_id:item.match_id,match_rating:item.match_rating,comment:item.comment,is_public:true,created_at:item.created_at}));
      if(table==='friendships')return structuredClone(state.friendships);
      if(table==='notifications')return structuredClone(state.notifications);
      if(table==='players')return structuredClone(state.players);
      if(table==='player_ratings')return state.playerRatings.map(r=>({...structuredClone(r),player:{name:state.players.find(p=>p.id===r.player_id)?.name||'Legacy Player'}}));
      if(table==='rating_likes'||table==='rating_comments'||table==='predictions'||table==='chat_messages')return[];
      return[];
    }

    function from(table){
      const query={filters:[],limitValue:null,head:false,countMode:null,orderBy:null,writeData:null,operation:'select'};
      const builder={
        select(_fields,options={}){query.head=Boolean(options.head);query.countMode=options.count||null;return builder;},
        eq(column,value){query.filters.push(row=>String(row[column])===String(value));return builder;},
        neq(column,value){query.filters.push(row=>String(row[column])!==String(value));return builder;},
        in(column,values){query.filters.push(row=>values.map(String).includes(String(row[column])));return builder;},
        ilike(column,value){const needle=String(value).replaceAll('%','').toLocaleLowerCase();query.filters.push(row=>String(row[column]||'').toLocaleLowerCase().includes(needle));return builder;},
        order(column,{ascending=true}={}){query.orderBy={column,ascending};return builder;},
        limit(value){query.limitValue=Number(value);return builder;},
        insert(value){query.operation='insert';query.writeData=value;return builder;},
        update(value){query.operation='update';query.writeData=value;return builder;},
        delete(){query.operation='delete';return builder;},
        upsert(value){query.operation='upsert';query.writeData=value;return builder;},
        maybeSingle(){return resolve(true);},
        single(){return resolve(true);},
        then(onFulfilled,onRejected){return resolve(false).then(onFulfilled,onRejected);}
      };
      function resolve(single){
        let rows=rowsFor(table).filter(row=>query.filters.every(filter=>filter(row)));
        if(query.orderBy)rows.sort((a,b)=>String(a[query.orderBy.column]||'').localeCompare(String(b[query.orderBy.column]||''))*(query.orderBy.ascending?1:-1));
        if(query.limitValue!==null)rows=rows.slice(0,query.limitValue);
        const count=table==='users'?6:table==='matches'?202:table==='ratings'?16:rows.length;
        if(query.operation==='update'&&table==='users'){
          const matchingIds=new Set(rows.map(row=>String(row.id)));
          state.users=state.users.map(row=>matchingIds.has(String(row.id))?{...row,...structuredClone(query.writeData)}:row);
          if(matchingIds.has(String(state.profile.id)))state.profile={...state.profile,...structuredClone(query.writeData)};
        }
        if(query.operation==='update'&&table==='notifications'){
          const matchingIds=new Set(rows.map(row=>row.id));
          state.notifications=state.notifications.map(row=>matchingIds.has(row.id)?{...row,...structuredClone(query.writeData)}:row);
        }
        if(query.operation!=='select')return Promise.resolve({data:query.writeData,error:null,count:null});
        return Promise.resolve({data:query.head?null:(single?(rows[0]||null):rows),error:null,count:query.countMode?count:null});
      }
      return builder;
    }

    window.__FOOTBAZED_TEST_CLIENT__={
      auth:{
        getSession:()=>promiseResult({session:{user:structuredClone(state.sessionUser)}}),
        getUser:()=>promiseResult({user:structuredClone(state.sessionUser)}),
        onAuthStateChange:callback=>{authListener=callback;return{data:{subscription:{unsubscribe(){authListener=null;}}}};},
        resetPasswordForEmail:(email,options)=>{state.passwordRecovery={email,options};return promiseResult({});},
        updateUser:attributes=>{state.updatedUser=attributes;return promiseResult({user:structuredClone(state.sessionUser)});},
        signOut:()=>{queueMicrotask(()=>authListener?.('SIGNED_OUT',null));return promiseResult(null);}
      },
      from,
      rpc,
      channel:()=>({on(){return this;},subscribe(){return this;}}),
      removeChannel:()=>promiseResult(null),
      storage:{from:bucket=>({
        upload:(path,file,options={})=>{
          state.storageUpload={bucket,path,size:file?.size||0,type:file?.type||'',options:structuredClone(options)};
          return promiseResult({path});
        },
        getPublicUrl:path=>({data:{publicUrl:`https://storage.example.test/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`}}),
        createSignedUrl:path=>promiseResult({signedUrl:`https://storage.example.test/signed/${String(path).split('/').map(encodeURIComponent).join('/')}`}),
        remove:paths=>promiseResult(paths)
      })}
    };
    window.__FOOTBAZED_TEST_AUTH__={
      emit:(event,session)=>authListener?.(event,session),
      session:()=>({user:structuredClone(state.sessionUser)}),
      recovery:()=>structuredClone(state.passwordRecovery||null),
      updatedUser:()=>structuredClone(state.updatedUser||null),
      storage:()=>structuredClone(state.storageUpload||null),
      profile:()=>structuredClone(state.profile),
      lastRating:()=>structuredClone(state.lastRatingPayload||null)
    };
  },{...fixture,...overrides});
}
