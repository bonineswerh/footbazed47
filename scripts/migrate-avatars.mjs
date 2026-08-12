import process from 'node:process';

const apply=process.argv.includes('--apply');
const supabaseUrl=String(process.env.SUPABASE_URL||'').replace(/\/$/u,'');
const serviceKey=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');

if(!supabaseUrl||!serviceKey){
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
const usersUrl=new URL(`${supabaseUrl}/rest/v1/users`);
usersUrl.searchParams.set('select','id,avatar_url');
usersUrl.searchParams.set('avatar_url','like.data:image/*');
const response=await fetch(usersUrl,{headers:{...headers,Range:'0-999'}});
if(!response.ok)throw new Error(`Could not read legacy avatars (${response.status})`);
const users=await response.json();

console.log(`${users.length} legacy avatar(s) found. Mode: ${apply?'apply':'dry-run'}.`);
if(!apply){
  console.log('Run again with --apply after reviewing this count.');
  process.exit(0);
}

for(const user of users){
  const match=String(user.avatar_url||'').match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/iu);
  if(!match){
    console.warn(`Skipping ${user.id}: unsupported data URL.`);
    continue;
  }
  const extension=match[1].toLowerCase().replace('jpeg','jpg');
  const contentType=extension==='jpg'?'image/jpeg':`image/${extension}`;
  const objectName=`${user.id}/legacy-avatar.${extension}`;
  const uploadUrl=`${supabaseUrl}/storage/v1/object/avatars/${objectName}`;
  const upload=await fetch(uploadUrl,{
    method:'POST',
    headers:{...headers,'Content-Type':contentType,'x-upsert':'true'},
    body:Buffer.from(match[2],'base64')
  });
  if(!upload.ok)throw new Error(`Avatar upload failed for ${user.id} (${upload.status})`);

  const publicUrl=`${supabaseUrl}/storage/v1/object/public/avatars/${objectName}`;
  const updateUrl=new URL(`${supabaseUrl}/rest/v1/users`);
  updateUrl.searchParams.set('id',`eq.${user.id}`);
  const update=await fetch(updateUrl,{
    method:'PATCH',
    headers:{...headers,'Content-Type':'application/json','Prefer':'return=minimal'},
    body:JSON.stringify({avatar_url:publicUrl})
  });
  if(!update.ok)throw new Error(`Profile update failed for ${user.id} (${update.status})`);
  console.log(`Migrated ${user.id}.`);
}

console.log('Legacy avatar migration completed.');
