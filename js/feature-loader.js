(function(root){
'use strict';
const featureModulePromises=new Map();
let interactionStyles=null;
function ensureInteractionStyles(){
  if(!interactionStyles)interactionStyles=stylesheet({key:'interaction-patterns',styleId:'interactionStyles',style:'css/interaction-patterns.css?v=20261009-controls'}).catch(error=>{interactionStyles=null;throw error;});
  return interactionStyles;
}
function stylesheet({key,styleId,style}){
  if(!style)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const existing=document.getElementById(styleId);
    if(existing?.dataset.loaded==='true'){resolve();return;}
    existing?.remove();
    const link=document.createElement('link');
    link.id=styleId;link.rel='stylesheet';link.href=style;
    const fail=()=>{clearTimeout(timer);link.remove();reject(new Error(`${key}_styles_failed`));};
    const timer=setTimeout(fail,15_000);
    link.addEventListener('load',()=>{clearTimeout(timer);link.dataset.loaded='true';resolve();},{once:true});
    link.addEventListener('error',fail,{once:true});document.head.append(link);
  });
}

function ensureFeatureModule({key,styleId,style,script,ready}){
  if(featureModulePromises.has(key))return featureModulePromises.get(key);
  if(ready()&&(!style||(document.getElementById(styleId)?.dataset.loaded==='true'&&document.getElementById('interactionStyles')?.dataset.loaded==='true')))return Promise.resolve(ready());

  const styles=stylesheet({key,styleId,style});
  const patterns=style?ensureInteractionStyles():Promise.resolve();

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

  const promise=Promise.allSettled([styles,patterns,module])
    .then(results=>{const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;return results[2].value;})
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
