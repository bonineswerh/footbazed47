'use strict';
const {verifySyncIdentity}=require('../server/security/sync-identity');
const {catalog}=require('./admin');
const LEAGUES=new Set(['PL','PD','BL1','SA','FL1','CL']);
function reply(res,status,body){
  res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}
function createHandler({identity=verifySyncIdentity,service=catalog,now=()=>new Date()}={}){
  return async(req,res)=>{
    if(req.method!=='POST')return reply(res,405,{error:'method_not_allowed'});
    // Never run a preview against production, even with a valid workflow token.
    if(process.env.VERCEL_ENV!=='production')return reply(res,503,{error:'production_only'});
    let league,run;
    try{
      ({runId:run}=await identity(req.headers?.authorization));
      league=req.query?.league;
      if(!LEAGUES.has(league))return reply(res,400,{error:'invalid_league'});
      const claim=await service.supabase('/rest/v1/rpc/claim_automatic_match_sync',{method:'POST',body:{p_league:league,p_run_id:run}});
      const claimed=JSON.parse(claim.raw);
      if(claimed===false)return reply(res,200,{status:'skipped',league});
      if(claimed!==true)throw new Error('invalid_sync_claim_response');
      const time=now().getTime();
      const dateFrom=new Date(time-2*86400000).toISOString().slice(0,10);
      const dateTo=new Date(time+7*86400000).toISOString().slice(0,10);
      const result=await service.syncMatches({league,dateFrom,dateTo});
      const logged=await service.recordAdminAction(null,'auto_sync_succeeded',{targetType:'league',targetId:league,metadata:{...result,run_id:run}});
      if(!logged)throw new Error('sync_audit_unavailable');
      return reply(res,200,{status:'updated',league,processed:result.processed});
    }catch(error){
      if(league&&run)await service.recordAdminAction(null,'auto_sync_failed',{targetType:'league',targetId:league,metadata:{run_id:run,status:Number(error.status)||502}});
      return reply(res,error.status===403?403:error.status===429?429:503,{error:error.status===403?'access_denied':'sync_unavailable'});
    }
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
