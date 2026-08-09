const fixture={
  sessionUser:{id:'3615141a-7700-46b8-9ba5-e4f4450537fc',email:'bazed@example.test'},
  profile:{
    id:'3615141a-7700-46b8-9ba5-e4f4450537fc',username:'bazed',display_name:'Bazed',avatar_url:null,
    bio:'Смотрю футбол внимательно.',favorite_teams:['Real Madrid'],ratings_count:11,avg_rating:7.8,
    streak:1,streak_date:'2026-08-09',is_public:true,created_at:'2026-04-02T10:00:00Z',is_admin:true
  },
  users:[
    {id:'3615141a-7700-46b8-9ba5-e4f4450537fc',username:'bazed',display_name:'Bazed',avatar_url:null,is_public:true,ratings_count:11,avg_rating:7.8},
    {id:'cd291181-2db6-42cb-9f3d-ef84ab3a9660',username:'gamlet',display_name:'Gamlet',avatar_url:null,is_public:true,ratings_count:8,avg_rating:8.1}
  ],
  matches:[
    {id:101,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',status:'finished',home_score:2,away_score:1,external_id:9101,league_code:'CL',matchday:1,season:'2026'},
    {id:102,league_name:'La Liga',home_team_name:'Real Madrid CF',away_team_name:'FC Barcelona',home_club_id:24,away_club_id:25,match_date:'2026-08-20T19:00:00Z',status:'scheduled',home_score:null,away_score:null,external_id:9102,league_code:'PD',matchday:2,season:'2026'}
  ],
  feed:[
    {rating_id:501,user_id:'cd291181-2db6-42cb-9f3d-ef84ab3a9660',match_id:101,match_rating:9,comment:'Сильный второй тайм и отличный контроль центра поля.',created_at:'2026-08-09T12:00:00Z',updated_at:'2026-08-09T12:00:00Z',user:{username:'gamlet',display_name:'Gamlet',avatar_url:null},match:{league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1},like_count:3,comment_count:1,liked_by_me:false,player_highlights:[{player_id:5290,name:'Thibaut Courtois',club_id:24,team:'Real Madrid CF',rating:8.7,is_best_player:true}]},
    {rating_id:502,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',match_id:101,match_rating:8,comment:'Матч решил темп после перерыва.',created_at:'2026-08-09T11:00:00Z',updated_at:'2026-08-09T11:00:00Z',user:{username:'bazed',display_name:'Bazed',avatar_url:null},match:{league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',home_club_id:24,away_club_id:31,match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1},like_count:1,comment_count:0,liked_by_me:false,player_highlights:[]}
  ],
  comments:{
    501:[{id:701,user_id:'3615141a-7700-46b8-9ba5-e4f4450537fc',comment:'Согласен насчёт второго тайма.',created_at:'2026-08-09T12:10:00Z',can_delete:true,user:{username:'bazed',display_name:'Bazed',avatar_url:null}}]
  },
  club:{
    club:{id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',crest_url:null,area_name:'Spain',venue:'Santiago Bernabéu',founded:1902,club_colors:'White / Purple'},
    competitions:['Champions League','La Liga'],
    stats:{squad_count:3,match_count:2,upcoming_count:1,player_rating:8.4,player_rating_count:6},
    squad:[
      {id:5290,name:'Thibaut Courtois',position:'GK',shirt_number:1,photo_url:null,average:8.7,rating_count:3,best_votes:2},
      {id:5291,name:'Antonio Rüdiger',position:'CB',shirt_number:22,photo_url:null,average:8.2,rating_count:2,best_votes:0},
      {id:5292,name:'Jude Bellingham',position:'AM',shirt_number:5,photo_url:null,average:8.4,rating_count:1,best_votes:1}
    ],
    matches:[]
  },
  player:{
    player:{id:5290,name:'Thibaut Courtois',position:'GK',shirt_number:1,photo_url:null,team:'Real Madrid CF',club:{id:24,name:'Real Madrid CF',short_name:'Real Madrid',tla:'RMA',crest_url:null}},
    stats:{average:8.7,rating_count:3,best_votes:2,matches_rated:1},
    performances:[{match_id:101,average:8.7,rating_count:3,best_votes:2,league_name:'Champions League',home_team_name:'Real Madrid CF',away_team_name:'Manchester City FC',match_date:'2026-08-08T19:00:00Z',home_score:2,away_score:1}],
    teammates:[{id:5291,name:'Antonio Rüdiger',position:'CB',shirt_number:22,photo_url:null},{id:5292,name:'Jude Bellingham',position:'AM',shirt_number:5,photo_url:null}]
  }
};

export async function installSupabaseMock(page){
  await page.addInitScript(data=>{
    const state=structuredClone(data);
    state.club.matches=structuredClone(state.matches);
    let nextCommentId=900;

    function promiseResult(data,error=null,count=null){
      const result=Promise.resolve({data,error,count});
      result.maybeSingle=()=>result;
      result.single=()=>result;
      return result;
    }

    function rpc(name,args={}){
      if(name==='get_my_profile')return promiseResult(structuredClone(state.profile));
      if(name==='get_social_feed'){
        let items=structuredClone(state.feed);
        if(args.p_scope==='mine')items=items.filter(item=>item.user_id===state.sessionUser.id);
        if(args.p_scope==='friends')items=items.filter(item=>item.user_id!==state.sessionUser.id);
        if(args.p_scope==='popular')items.sort((a,b)=>b.like_count-a.like_count);
        const offset=Number(args.p_offset)||0;
        const limit=Number(args.p_limit)||12;
        const pageItems=items.slice(offset,offset+limit);
        return promiseResult({items:pageItems,has_more:offset+limit<items.length,next_offset:offset+pageItems.length});
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
      if(name==='get_player_page')return promiseResult(Number(args.p_player_id)===5290?structuredClone(state.player):null);
      if(name==='get_match_insights')return promiseResult({rating_count:2,average:8.5,distribution:Array.from({length:10},(_,index)=>({score:10-index,count:index===1?1:index===2?1:0})),top_players:[{player_id:5290,name:'Thibaut Courtois',team:'Real Madrid CF',average:8.7,rating_count:3,best_votes:2}]});
      if(name==='search_footbazed')return promiseResult([]);
      return promiseResult(null);
    }

    function rowsFor(table){
      if(table==='users')return structuredClone(state.users);
      if(table==='matches')return structuredClone(state.matches);
      if(table==='ratings')return state.feed.map(item=>({id:item.rating_id,user_id:item.user_id,match_id:item.match_id,match_rating:item.match_rating,comment:item.comment,is_public:true,created_at:item.created_at}));
      if(table==='notifications'||table==='friendships'||table==='rating_likes'||table==='rating_comments'||table==='predictions'||table==='chat_messages'||table==='players')return[];
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
        if(query.operation!=='select')return Promise.resolve({data:query.writeData,error:null,count:null});
        return Promise.resolve({data:query.head?null:(single?(rows[0]||null):rows),error:null,count:query.countMode?count:null});
      }
      return builder;
    }

    window.__FOOTBAZED_TEST_CLIENT__={
      auth:{
        getSession:()=>promiseResult({session:{user:structuredClone(state.sessionUser)}}),
        onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
        signOut:()=>promiseResult(null)
      },
      from,
      rpc,
      channel:()=>({on(){return this;},subscribe(){return this;}}),
      removeChannel:()=>promiseResult(null),
      storage:{from:()=>({upload:()=>promiseResult(null),getPublicUrl:()=>({data:{publicUrl:''}})})}
    };
  },fixture);
}
