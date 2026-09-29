// Read-only deployed-site checks. No login, Supabase request or data mutation.
import assert from 'node:assert/strict';

const origin=new URL(process.argv[2]||'https://footbazed47.vercel.app');
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Pass an HTTPS origin without credentials, path or query.');
const get=async path=>{
  const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(15_000),redirect:'error'});
  return {response,body:await response.text()};
};
const home=await get('/');
assert.equal(home.response.status,200);
for(const header of ['content-security-policy','x-content-type-options','x-frame-options'])assert.ok(home.response.headers.get(header),`Missing ${header}`);
const map=await get('/sitemap.xml');
assert.equal(map.response.status,200);
assert.ok(map.body.includes('/discover</loc>'));
for(const kind of ['club','player','match','competition']){
  const path=map.body.match(new RegExp(`/${kind}/[1-9]\\d*`))?.[0];
  assert.ok(path,`Missing ${kind} route in sitemap`);
  const {response,body}=await get(path);
  assert.equal(response.status,200,`${path} response`);
  assert.ok(body.includes(`href="${origin.origin}${path}"`),`${path} initial canonical`);
  assert.ok(!body.includes('<title>FOOTBAZED — Оценивай футбол вместе</title>'),`${path} initial title`);
  assert.ok(body.includes('id="fbzStructuredData"'),`${path} initial schema`);
  console.log(`PASS ${path}: initial metadata, schema, HTTP 200`);
}
for(const path of ['/matches','/discover']){
  const {response,body}=await get(path);assert.equal(response.status,200);
  assert.ok(body.includes(`href="${origin.origin}${path}"`),`${path} initial canonical`);
}
const denied=await get('/api/admin');assert.equal(denied.response.status,403);
assert.ok(!/service_role|access_token|SUPABASE_SERVICE_ROLE_KEY/.test(denied.body));
console.log('PASS home, public routes, security headers, sitemap and unauthenticated admin denial.');
