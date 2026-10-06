(function(root){
'use strict';
const featureModulePromises=new Map();

function ensureFeatureModule({key,styleId,style,script,ready}){
  if(featureModulePromises.has(key))return featureModulePromises.get(key);
  if(ready()&&(!style||document.getElementById(styleId)?.dataset.loaded==='true'))return Promise.resolve(ready());

  const stylesheet=style?new Promise((resolve,reject)=>{
    const existing=document.getElementById(styleId);
    if(existing?.dataset.loaded==='true'){resolve();return;}
    existing?.remove();
    const link=document.createElement('link');
    link.id=styleId;
    link.rel='stylesheet';
    link.href=style;
    const fail=()=>{clearTimeout(timer);link.remove();reject(new Error(`${key}_styles_failed`));};
    const timer=setTimeout(fail,15_000);
    link.addEventListener('load',()=>{clearTimeout(timer);link.dataset.loaded='true';resolve();},{once:true});
    link.addEventListener('error',fail,{once:true});
    document.head.append(link);
  }):Promise.resolve();

  const module=new Promise((resolve,reject)=>{
    if(ready()){resolve(ready());return;}
    const element=document.createElement('script');
    element.src=root.FBZLocale?.asset(script)||script;
    element.async=true;
    const fail=()=>{clearTimeout(timer);element.remove();reject(new Error(`${key}_module_failed`));};
    const timer=setTimeout(fail,15_000);
    element.addEventListener('load',()=>{
      clearTimeout(timer);
      if(ready())resolve(ready());
      else{element.remove();reject(new Error(`${key}_module_missing`));}
    },{once:true});
    element.addEventListener('error',fail,{once:true});
    document.body.append(element);
  });

  const promise=Promise.allSettled([stylesheet,module])
    .then(results=>{const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;return results[1].value;})
    .catch(error=>{
      featureModulePromises.delete(key);
      console.warn(`${key} module load error:`,error);
      root.toast?.('Не удалось загрузить раздел','err');
      throw error;
    });
  featureModulePromises.set(key,promise);
  return promise;
}

root.FBZFeatures=Object.freeze({load:ensureFeatureModule});
})(window);
