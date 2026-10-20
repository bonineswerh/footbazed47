'use strict';
const {createPublicKey,verify}=require('node:crypto');
const ISSUER='https://token.actions.githubusercontent.com';
const AUDIENCE='https://footbazed47.vercel.app/api/sync-results';
const WORKFLOW='bonineswerh/footbazed47/.github/workflows/sync-results.yml@refs/heads/main';
let cache=null;
function reject(){throw Object.assign(new Error('sync_identity_denied'),{status:403});}
function claimsAllowed(c,now){
  return c.iss===ISSUER&&c.aud===AUDIENCE&&c.repository==='bonineswerh/footbazed47'
    &&c.repository_id==='1161780183'&&c.repository_owner_id==='261181787'
    &&c.ref==='refs/heads/main'&&c.workflow_ref===WORKFLOW
    &&c.sub==='repo:bonineswerh/footbazed47:ref:refs/heads/main'
    &&['schedule','workflow_dispatch'].includes(c.event_name)
    &&/^\d{1,24}$/.test(c.run_id||'')
    &&Number.isInteger(c.iat)&&Number.isInteger(c.exp)&&Number.isInteger(c.nbf)
    &&c.iat<=now+30&&c.iat>=now-600&&c.nbf<=now+30&&c.exp>now&&c.exp-c.iat<=600;
}
async function githubKeys(){
  if(cache&&cache.until>Date.now())return cache.keys;
  const response=await fetch(`${ISSUER}/.well-known/jwks`,{redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw new Error('identity_provider_unavailable');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('identity_response_too_large');chunks.push(Buffer.from(value));}
  }finally{await reader.cancel();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!Array.isArray(data.keys)||data.keys.length>20)throw new Error('invalid_identity_keys');
  cache={until:Date.now()+300000,keys:data.keys};return data.keys;
}
async function verifySyncIdentity(authorization,{keys=githubKeys,now=Math.floor(Date.now()/1000)}={}){
  if(typeof authorization!=='string'||authorization.length>16000||!authorization.startsWith('Bearer '))reject();
  const token=authorization.slice(7),parts=token.split('.');
  if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))reject();
  let header,claims;
  try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{reject();}
  if(!header||!claims||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>160||header.crit||!claimsAllowed(claims,now))reject();
  const candidates=(await keys()).filter(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
  if(candidates.length!==1)reject();
  let valid=false;
  try{valid=verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:candidates[0],format:'jwk'}),Buffer.from(parts[2],'base64url'));}catch{reject();}
  if(!valid)reject();
  return {runId:claims.run_id};
}
module.exports={verifySyncIdentity,claimsAllowed,AUDIENCE,WORKFLOW};
