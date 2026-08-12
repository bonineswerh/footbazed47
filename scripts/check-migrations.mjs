import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const migrationsDir=resolve(root,'supabase','migrations');
const files=(await readdir(migrationsDir)).filter(file=>file.endsWith('.sql')).sort();
const required=[
  '20260809120330_security_foundation_and_data_integrity_v2.sql',
  '20260809122317_protect_relationship_identity_and_unused_tables.sql',
  '20260809122825_least_privilege_api_grants_after_admin_deploy.sql'
];

assert(files.length>=required.length,'No complete migration history found');
for(const file of files)assert.match(file,/^\d{14}_[a-z0-9_]+\.sql$/u,`Invalid migration name: ${file}`);
assert.equal(new Set(files.map(file=>file.slice(0,14))).size,files.length,'Duplicate migration version');
for(const file of required)assert(files.includes(file),`Missing recovered migration: ${file}`);

for(const file of files){
  const sql=await readFile(resolve(migrationsDir,file),'utf8');
  assert(sql.trim(),`Empty migration: ${file}`);
  assert(!/service[_-]?role\s*[=:]\s*['"][^'"]+/iu.test(sql),`Possible service-role secret in ${file}`);
}

const latest=await readFile(resolve(migrationsDir,'20260810160352_rating_roster_and_atomic_friendships.sql'),'utf8');
for(const contract of ['validate_player_rating_roster','request_friendship','respond_friendship','remove_friendship']){
  assert(latest.includes(contract),`Missing database contract: ${contract}`);
}

const matchesPage=files.find(file=>file.endsWith('_server_match_pagination.sql'));
assert(matchesPage,'Missing server match pagination migration');
const matchesSql=await readFile(resolve(migrationsDir,matchesPage),'utf8');
for(const contract of ['get_matches_page','security invoker','p_offset','p_limit']){
  assert(matchesSql.toLocaleLowerCase('en-US').includes(contract),`Missing match pagination contract: ${contract}`);
}

const feedCursorMigration=files.find(file=>file.endsWith('_cursor_social_feed.sql'));
assert(feedCursorMigration,'Missing cursor-based social feed migration');
const feedCursorSql=(await readFile(resolve(migrationsDir,feedCursorMigration),'utf8')).toLocaleLowerCase('en-US');
for(const contract of ['get_social_feed_page','p_cursor_created_at','p_cursor_rating_id','p_cursor_score','ratings_public_created_id_idx']){
  assert(feedCursorSql.includes(contract),`Missing cursor feed contract: ${contract}`);
}

const communityLimitsMigration=files.find(file=>file.endsWith('_community_rate_limits_and_explicit_denies.sql'));
assert(communityLimitsMigration,'Missing community abuse controls migration');
const communityLimitsSql=(await readFile(resolve(migrationsDir,communityLimitsMigration),'utf8')).toLocaleLowerCase('en-US');
for(const contract of ['enforce_community_rate_limit','pg_advisory_xact_lock','comment_rate_limit','chat_rate_limit','explicitly deny client access']){
  assert(communityLimitsSql.includes(contract),`Missing community protection contract: ${contract}`);
}

const friendshipEnforcementMigration=files.find(file=>file.endsWith('_enforce_atomic_friendship_writes.sql'));
assert(friendshipEnforcementMigration,'Missing atomic friendship write enforcement migration');
const friendshipEnforcementSql=(await readFile(resolve(migrationsDir,friendshipEnforcementMigration),'utf8')).toLocaleLowerCase('en-US');
for(const contract of ['drop policy','revoke insert, update, delete','request_friendship','respond_friendship','remove_friendship']){
  assert(friendshipEnforcementSql.includes(contract),`Missing friendship enforcement contract: ${contract}`);
}

const auditMigration=files.find(file=>file.endsWith('_admin_audit_log.sql'));
assert(auditMigration,'Missing admin audit log migration');
const auditSql=await readFile(resolve(migrationsDir,auditMigration),'utf8');
for(const contract of ['admin_audit_logs','enable row level security','revoke all','service_role']){
  assert(auditSql.toLocaleLowerCase('en-US').includes(contract),`Missing admin audit contract: ${contract}`);
}

const auditLockMigration=files.find(file=>file.endsWith('_lock_admin_audit_append_only.sql'));
assert(auditLockMigration,'Missing append-only admin audit migration');
const auditLockSql=(await readFile(resolve(migrationsDir,auditLockMigration),'utf8')).toLocaleLowerCase('en-US');
for(const contract of ['revoke all','grant select, insert','service_role']){
  assert(auditLockSql.includes(contract),`Missing append-only audit contract: ${contract}`);
}
assert(!auditLockSql.includes('grant update'), 'Admin audit log must remain append-only');
assert(!auditLockSql.includes('grant delete'), 'Admin audit log must remain append-only');

console.log(`Migration checks passed: ${files.length} files`);
