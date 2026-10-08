'use strict';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function denied(code){return Object.assign(new Error(code),{status:403,code,name:'AdminAccessError'});}

// Call only AFTER Auth has validated the bearer signature and returned this user.
// Parsing here does not authenticate a token; it binds that trusted result to its session.
function trustedClaims(authorization,userId,baseUrl,now=Math.floor(Date.now()/1000)){
  const token=authorization.slice(7);
  if(token.length>16000||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))throw denied('admin_session_invalid');
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{throw denied('admin_session_invalid');}
  if(!claims||claims.sub!==userId||!UUID.test(claims.session_id||'')||claims.iss!==`${baseUrl.replace(/\/$/,'')}/auth/v1`
    ||claims.role!=='authenticated'||!(claims.aud==='authenticated'||Array.isArray(claims.aud)&&claims.aud.includes('authenticated'))
    ||!Number.isSafeInteger(claims.exp)||claims.exp<=now||!Number.isSafeInteger(claims.iat)||claims.iat>now+30
    ||!['aal1','aal2'].includes(claims.aal))throw denied('admin_session_invalid');
  return claims;
}
function requireMfa(claims,session,{recent=false,now=Math.floor(Date.now()/1000)}={}){
  if(session?.active!==true)throw denied('admin_session_invalid');
  if(claims.aal!=='aal2'||session.aal!=='aal2'||session.factor_verified!==true)throw denied('admin_mfa_required');
  if(recent&&(!Array.isArray(claims.amr)||!claims.amr.some(entry=>entry?.method==='totp'&&Number.isSafeInteger(entry.timestamp)&&entry.timestamp<=now&&entry.timestamp>=now-300)))throw denied('admin_mfa_recent_required');
}
module.exports={trustedClaims,requireMfa,denied};
