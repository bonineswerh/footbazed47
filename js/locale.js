(function(root){
  'use strict';
  const language=/^\/en(?:\/|$)/u.test(location.pathname)?'en':'ru';
  const strip=path=>String(path||'/').replace(/^\/en(?=\/|$)/u,'')||'/';
  const path=(value,lang=language)=>{
    const url=new URL(value,location.origin);
    if(url.origin!==location.origin)return url.href;
    const base=strip(url.pathname);
    return (lang==='en'?'/en':'')+(lang==='en'&&base==='/'?'':base)+url.search+url.hash;
  };
  const save=lang=>{try{localStorage.setItem('fbz_language',lang==='en'?'en':'ru');}catch{}};
  root.FBZLocale=Object.freeze({language,intl:language==='en'?'en-GB':'ru-RU',strip,path,
    asset:value=>language==='en'&&!/^(?:\/api\/|https?:)/u.test(value)?'/en-assets/'+String(value).replace(/^\//u,''):value,
    switchTo:lang=>{save(lang);if(lang!==language)location.assign(path(location.href,lang));},save});
  document.documentElement.lang=language;
  // A saved choice applies to the entry page. Explicit deep links keep their language.
  if(language==='ru'&&location.pathname==='/'){
    try{if(localStorage.getItem('fbz_language')==='en')location.replace(path(location.href,'en'));}catch{}
  }
})(window);
