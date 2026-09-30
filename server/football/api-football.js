'use strict';

const https = require('node:https');
const BASE_URL = 'https://v3.football.api-sports.io';
const PARAMETERS = Object.freeze({
  '/status': [],
  '/leagues': ['id', 'season'],
  '/teams': ['league', 'season', 'id'],
  '/fixtures': ['league', 'season', 'from', 'to', 'id', 'page'],
  '/players': ['league', 'season', 'team', 'id', 'page'],
  '/players/squads': ['team', 'player']
});
const PILOT_COMPETITIONS = Object.freeze({PL:39, PD:140, BL1:78, SA:135, FL1:61, CL:2});

class FootballProviderError extends Error {
  constructor(code, status = 502, quota = null) {
    super(code);
    this.name = 'FootballProviderError';
    this.code = code;
    this.status = status;
    this.quota = quota;
  }
}

function integer(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function quotaHeaders(headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key,value]) => [key.toLowerCase(),value]));
  const header = key => integer(normalized[key]);
  return {
    dailyLimit: header('x-ratelimit-requests-limit'),
    dailyRemaining: header('x-ratelimit-requests-remaining'),
    minuteLimit: header('x-ratelimit-limit'),
    minuteRemaining: header('x-ratelimit-remaining'),
    retryAfterSeconds: header('retry-after')
  };
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function requireId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new FootballProviderError('invalid_provider_parameters',400);
  return value;
}
function requireSeason(value) {
  if (!Number.isInteger(value) || value < 1990 || value > new Date().getUTCFullYear()+1) throw new FootballProviderError('invalid_provider_parameters',400);
  return value;
}
function requestUrl(endpoint, params) {
  if (!Object.hasOwn(PARAMETERS, endpoint) || !isObject(params)) throw new FootballProviderError('invalid_provider_parameters',400);
  const url = new URL(endpoint,BASE_URL);
  for (const [key,value] of Object.entries(params)) {
    if (!PARAMETERS[endpoint].includes(key)) throw new FootballProviderError('invalid_provider_parameters',400);
    if (key==='season') requireSeason(value);
    else if (key==='from' || key==='to') {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new FootballProviderError('invalid_provider_parameters',400);
    } else requireId(value);
    url.searchParams.set(key,String(value));
  }
  return url;
}

function createApiFootballClient({apiKey = process.env.API_FOOTBALL_KEY, transport = https, timeoutMs = 8000, maxResponseBytes = 4*1024*1024, requestBudget = 4, reserve = 10, retries = 0} = {}) {
  if (!Number.isInteger(requestBudget) || requestBudget<1 || requestBudget>30 || !Number.isInteger(retries) || retries<0 || retries>1 || !Number.isInteger(reserve) || reserve<0 || !Number.isInteger(timeoutMs) || timeoutMs<1 || timeoutMs>15000 || !Number.isInteger(maxResponseBytes) || maxResponseBytes<1 || maxResponseBytes>8*1024*1024) throw new FootballProviderError('invalid_provider_configuration',400);
  let requests=0, quota=null;
  const deadline=Date.now()+Math.min(40000,timeoutMs*requestBudget);

  function capacity(count=1) {
    if (requests+count>requestBudget) throw new FootballProviderError('provider_request_budget',429,quota);
    if (Date.now()>=deadline) throw new FootballProviderError('provider_timeout',502,quota);
    if (requests>0) {
      if (!quota || quota.dailyRemaining===null || quota.minuteRemaining===null) throw new FootballProviderError('provider_quota_unknown',429,quota);
      if (quota.dailyRemaining-count<reserve || quota.minuteRemaining<count) throw new FootballProviderError('provider_quota_reserve',429,quota);
    }
  }

  async function once(url) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) throw new FootballProviderError('provider_not_configured',503);
    capacity();requests++;
    if (quota) quota={...quota,dailyRemaining:quota.dailyRemaining===null?null:Math.max(0,quota.dailyRemaining-1),minuteRemaining:quota.minuteRemaining===null?null:Math.max(0,quota.minuteRemaining-1)};
    return new Promise((resolve,reject) => {
      let req,response,timer,settled=false,bytes=0;
      const chunks=[];
      function finish(error,value) {
        if (settled) return;
        settled=true;clearTimeout(timer);
        if (error) { reject(error); response?.destroy?.(); req?.destroy(); }
        else resolve(value);
      }
      timer=setTimeout(() => finish(new FootballProviderError('provider_timeout',502,quota)),Math.min(timeoutMs,deadline-Date.now()));
      try {
        req=transport.request(url,{method:'GET',headers:{'x-apisports-key':apiKey,Accept:'application/json'}},incoming => {
          response=incoming;quota=quotaHeaders(incoming.headers);
          incoming.on('error',() => finish(new FootballProviderError('provider_network_error',502,quota)));
          incoming.on('aborted',() => finish(new FootballProviderError('provider_incomplete_response',502,quota)));
          incoming.on('close',() => { if (!settled) finish(new FootballProviderError('provider_incomplete_response',502,quota)); });
          incoming.on('data',chunk => {
            if (settled) return;
            const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
            bytes+=data.length;
            if (bytes>maxResponseBytes) return finish(new FootballProviderError('provider_response_too_large',502,quota));
            chunks.push(data);
          });
          incoming.on('end',() => {
            if (settled) return;
            const status=Number(incoming.statusCode);
            if (status!==200) {
              const code=status===429?'provider_rate_limit':status===401||status===403?'provider_access_denied':status===499||status===500||status===502||status===503||status===504?'provider_temporary_error':'provider_http_error';
              return finish(new FootballProviderError(code,status===429?429:502,quota));
            }
            let payload;
            try { payload=JSON.parse(Buffer.concat(chunks).toString('utf8')); }
            catch (_) { return finish(new FootballProviderError('provider_invalid_response',502,quota)); }
            if (!isObject(payload) || (!isObject(payload.errors) && !Array.isArray(payload.errors))) return finish(new FootballProviderError('provider_invalid_response',502,quota));
            if (Object.keys(payload.errors).length) {
              const keys=Object.keys(payload.errors).map(key=>key.toLowerCase());
              const limited=keys.some(key=>['requests','ratelimit','rate_limit'].includes(key));
              const denied=keys.some(key=>['token','key','access','plan'].includes(key));
              return finish(new FootballProviderError(limited?'provider_rate_limit':denied?'provider_access_denied':'provider_api_error',limited?429:502,quota));
            }
            if (url.pathname==='/status') {
              // Account metadata is an object, not a paginated collection. The
              // provider reports zero results and may omit its paging wrapper.
              if (!isObject(payload.response) || ![0,1].includes(payload.results) || (payload.paging!==undefined && (!isObject(payload.paging) || payload.paging.current!==1 || payload.paging.total!==1))) return finish(new FootballProviderError('provider_invalid_response',502,quota));
              return finish(null,{items:payload.response,paging:{current:1,total:1},quota,requests});
            }
            if (!isObject(payload.paging) || !Number.isInteger(payload.paging.current) || payload.paging.current<1 || !Number.isInteger(payload.paging.total) || payload.paging.total<1 || payload.paging.current>payload.paging.total || !Number.isInteger(payload.results) || payload.results<0 || !Array.isArray(payload.response) || payload.response.length!==payload.results || payload.response.some(item=>!isObject(item))) return finish(new FootballProviderError('provider_invalid_response',502,quota));
            finish(null,{items:payload.response,paging:{current:payload.paging.current,total:payload.paging.total},quota,requests});
          });
        });
        req.on('error',() => finish(new FootballProviderError('provider_network_error',502,quota)));
        req.end();
      } catch (_) { finish(new FootballProviderError('provider_network_error',502,quota)); }
    });
  }

  async function get(endpoint,params={}) {
    const url=requestUrl(endpoint,params);
    let attempt=0;
    while (true) {
      try {
        const result=await once(url);
        if (result.paging.current!==(params.page||1)) throw new FootballProviderError('provider_invalid_pagination',502,quota);
        return result;
      } catch (error) {
        if (attempt>=retries || !['provider_temporary_error','provider_network_error'].includes(error.code)) throw error;
        capacity();attempt++;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
    }
  }

  async function collection(endpoint,params={}, {maxPages=3,maxItems=2000}={}) {
    if (!Number.isInteger(maxPages) || maxPages<1 || maxPages>30 || !Number.isInteger(maxItems) || maxItems<1 || maxItems>6000 || endpoint==='/status' || Object.hasOwn(params,'page')) throw new FootballProviderError('invalid_provider_parameters',400);
    const first=await get(endpoint,params);
    const total=first.paging.total;
    if (total>maxPages || first.items.length>maxItems || (total>1 && !PARAMETERS[endpoint].includes('page'))) throw new FootballProviderError('provider_pagination_limit',502,quota);
    if (total>1) capacity(total-1);
    const items=[...first.items];
    for (let page=2;page<=total;page++) {
      const next=await get(endpoint,{...params,page});
      if (next.paging.total!==total || !next.items.length || items.length+next.items.length>maxItems) throw new FootballProviderError('provider_incomplete_collection',502,quota);
      items.push(...next.items);
    }
    return {items,pages:total,requests,quota};
  }

  async function accountStatus() {
    const result=await get('/status');
    const {subscription,requests:usage}=result.items;
    if (!isObject(subscription) || typeof subscription.active!=='boolean' || typeof subscription.plan!=='string' || !subscription.plan.trim() || subscription.plan.length>80 || !isObject(usage) || integer(usage.current)===null || integer(usage.limit_day)===null || integer(usage.current)>integer(usage.limit_day)) throw new FootballProviderError('provider_invalid_account',502,quota);
    const knownPlans={free:'Free',pro:'Pro',ultra:'Ultra',mega:'Mega',custom:'Custom'};
    const planKey=subscription.plan.trim().toLowerCase();
    const plan=Object.hasOwn(knownPlans,planKey)?knownPlans[planKey]:'Другой тариф';
    return {provider:'api-football',configured:true,active:subscription.active,plan,dailyUsed:integer(usage.current),dailyLimit:integer(usage.limit_day),dailyRemaining:Math.max(0,integer(usage.limit_day)-integer(usage.current)),quota:result.quota,checkedAt:new Date().toISOString()};
  }

  async function competitionStatus(code,season) {
    if (!Object.hasOwn(PILOT_COMPETITIONS,code)) throw new FootballProviderError('invalid_provider_parameters',400);
    requireSeason(season);
    const providerId=PILOT_COMPETITIONS[code];
    const result=await collection('/leagues',{id:providerId,season},{maxPages:1,maxItems:1});
    if (!result.items.length) return {provider:'api-football',code,providerId,season,available:false,quota:result.quota};
    const item=result.items[0];
    if (!isObject(item.league) || item.league.id!==providerId || typeof item.league.name!=='string' || !item.league.name.trim() || item.league.name.length>160 || !Array.isArray(item.seasons)) throw new FootballProviderError('provider_invalid_competition',502,quota);
    const selected=item.seasons.filter(value=>isObject(value)&&value.year===season);
    if (selected.length!==1 || !isObject(selected[0].coverage)) throw new FootballProviderError('provider_invalid_coverage',502,quota);
    const coverage=selected[0].coverage;
    const flag=value=>typeof value==='boolean'?value:null;
    return {provider:'api-football',code,providerId,season,available:true,name:item.league.name.trim(),coverage:{players:flag(coverage.players),lineups:flag(coverage.fixtures?.lineups),events:flag(coverage.fixtures?.events),playerStatistics:flag(coverage.fixtures?.statistics_players)},quota:result.quota};
  }

  return Object.freeze({get,collection,accountStatus,competitionStatus});
}

module.exports={createApiFootballClient,FootballProviderError,quotaHeaders,PILOT_COMPETITIONS};
