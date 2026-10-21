'use strict';
const LEAGUES=new Set(['PL','PD','BL1','SA','FL1','CL']);
function deny(){throw Object.assign(new Error('sync_ticket_denied'),{status:403});}
function createTicketIdentity(service){
  return async(authorization,{league}={})=>{
    if(typeof authorization!=='string'||!/^Bearer [a-f0-9]{64}$/.test(authorization)||!LEAGUES.has(league))deny();
    const result=await service.supabase('/rest/v1/rpc/consume_match_sync_ticket',{
      method:'POST',body:{p_token:authorization.slice(7),p_league:league}
    });
    const run=JSON.parse(result.raw);
    if(typeof run!=='string'||!/^9\d{16,23}$/.test(run))deny();
    return {runId:run};
  };
}
module.exports={createTicketIdentity};
