(function(root,factory){
  'use strict';
  const api=factory(root);
  if(root)root.FBZMedia=Object.freeze(api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null,function(root){
  'use strict';

  const assetTypes=Object.freeze({
    club:'club_logo',
    player:'player_photo',
    competition:'competition_logo',
    team:'team_photo',
    other:'other'
  });
  const palettes=Object.freeze([
    ['#19b8a6','#b6f36b'],
    ['#2878d8','#72d6ff'],
    ['#b93d5b','#ffbc67'],
    ['#6654c8','#d6b5ff'],
    ['#187b55','#9be08d'],
    ['#4c6475','#c6d2da']
  ]);
  const providers=new Map();

  function escapeHtml(value){
    if(root?.esc)return root.esc(value);
    return String(value??'').replace(/[&<>'"]/g,character=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[character]);
  }

  function initials(value){
    const result=String(value||'FB').trim().split(/\s+/u).filter(Boolean).slice(0,2)
      .map(part=>part[0]||'').join('').toLocaleUpperCase('ru-RU');
    return result||'FB';
  }

  function color(value){
    const candidate=String(value||'').trim();
    return /^#[0-9a-f]{6}$/iu.test(candidate)?candidate.toUpperCase():'';
  }

  function palette(entity){
    const key=String(entity?.id??entity?.name??'footbazed');
    let hash=0;
    for(const character of key)hash=((hash<<5)-hash+character.codePointAt(0))|0;
    const fallback=palettes[Math.abs(hash)%palettes.length];
    return [color(entity?.primary_color)||fallback[0],color(entity?.secondary_color)||fallback[1]];
  }

  function safeHttpsUrl(value){
    const candidate=String(value||'').trim();
    if(!candidate)return'';
    try{
      const parsed=new URL(candidate,root?.location?.origin||'https://footbazed.invalid');
      return parsed.protocol==='https:'?parsed.href:'';
    }catch{return'';}
  }

  function resolveAsset(asset,expectedType){
    if(!asset||typeof asset!=='object')return null;
    const status=String(asset.usage_status||'').toLocaleLowerCase('en-US');
    const type=String(asset.asset_type||'').toLocaleLowerCase('en-US');
    if(status!=='verified'||(expectedType&&type!==expectedType))return null;
    const url=safeHttpsUrl(asset.url||asset.storage_url||asset.source_url);
    if(!url)return null;
    return Object.freeze({
      id:asset.id??null,
      assetType:type,
      url,
      sourceProvider:String(asset.source_provider||''),
      attribution:String(asset.attribution||''),
      licenseName:String(asset.license_name||''),
      licenseUrl:safeHttpsUrl(asset.license_url),
      usageStatus:'verified'
    });
  }

  function visual({entity={},kind='other',className='entity-mark',alt='',loading='lazy'}={}){
    const expectedType=assetTypes[kind]||assetTypes.other;
    const resolved=resolveAsset(entity.media,expectedType);
    const classes=`fbz-media ${className}${resolved?' has-image':' is-fallback'}`;
    if(resolved){
      return `<span class="${escapeHtml(classes)}"><img src="${escapeHtml(resolved.url)}" alt="${escapeHtml(alt)}" loading="${loading==='eager'?'eager':'lazy'}" decoding="async"></span>`;
    }
    const [primary,secondary]=palette(entity);
    const label=kind==='player'?`Фото ${entity.name||'игрока'} отсутствует`:`Логотип ${entity.name||'не добавлен'}`;
    return `<span class="${escapeHtml(classes)}" style="--media-primary:${primary};--media-secondary:${secondary}" role="img" aria-label="${escapeHtml(label)}"><span>${escapeHtml(initials(entity.name))}</span></span>`;
  }

  function registerProvider(provider){
    const id=String(provider?.id||'').trim();
    if(!/^[a-z0-9_-]{2,40}$/u.test(id)||typeof provider?.resolve!=='function')throw new TypeError('invalid_media_provider');
    if(providers.has(id))throw new Error('media_provider_already_registered');
    providers.set(id,Object.freeze({id,resolve:provider.resolve}));
    return id;
  }

  async function resolveFromProvider(id,request){
    const provider=providers.get(String(id||''));
    if(!provider)throw new Error('media_provider_not_registered');
    return provider.resolve(Object.freeze({...request}));
  }

  return Object.freeze({assetTypes,initials,palette,registerProvider,resolveAsset,resolveFromProvider,visual});
});
