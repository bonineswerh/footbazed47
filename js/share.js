(function(root){
  'use strict';
  let version=0;
  root.addEventListener('fbz:session-change',()=>{version++;});

  function fitted(ctx,text,x,y,width,size=32){
    let fontSize=size;
    const value=String(text??'');
    do{ctx.font=`650 ${fontSize}px "Onest Variable",sans-serif`;fontSize--;}while(ctx.measureText(value).width>width&&fontSize>=18);
    let result=value;
    while(ctx.measureText(result).width>width&&result.length>1)result=result.slice(0,-2)+'…';
    ctx.fillText(result,x,y);
  }

  function lines(ctx,text,width,maxLines){
    const result=[];
    let line='';
    for(const word of String(text||'').trim().split(/\s+/u)){
      const candidate=line?line+' '+word:word;
      if(ctx.measureText(candidate).width<=width){line=candidate;continue;}
      if(line){result.push(line);line='';}
      for(const char of word){
        if(ctx.measureText(line+char).width>width){result.push(line);line='';}
        line+=char;
      }
    }
    if(line)result.push(line.trim());
    if(result.length>maxLines){
      result.length=maxLines;
      result[maxLines-1]=result[maxLines-1].slice(0,-2)+'…';
    }
    return result;
  }

  async function open(type,data={}){
    const token=++version,route=routeVersion,user=CU?.id;
    await document.fonts.load('650 32px "Onest Variable"','Футбол FOOTBAZED 0123456789');
    if(token!==version||route!==routeVersion||CU?.id!==user)return;
    const canvas=document.getElementById('shareCanvas');
    canvas.width=1200;canvas.height=800;
    const ctx=canvas.getContext('2d');
    ctx.scale(2,2);
    ctx.fillStyle='#0d1716';ctx.fillRect(0,0,600,400);
    ctx.fillStyle='#91e6cc';ctx.fillRect(32,60,48,3);
    ctx.font='700 15px "Onest Variable",sans-serif';ctx.fillText('FOOTBAZED',32,36);
    ctx.strokeStyle='#263d35';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(32,338);ctx.lineTo(568,338);ctx.stroke();
    ctx.fillStyle='#b9c9c2';ctx.font='13px "Onest Variable",sans-serif';ctx.fillText('Футбол вашими глазами',32,374);

    if(type==='profile'){
      ctx.fillStyle='#f4fbf7';fitted(ctx,data.name||data.username||'Болельщик',32,112,536,36);
      ctx.fillStyle='#b9c9c2';ctx.font='15px "Onest Variable",sans-serif';ctx.fillText('@'+String(data.username||'user').slice(0,32),32,141);
      const stats=[{v:data.ratings||0,l:'Матчей в дневнике'},{v:data.avg||'—',l:'Средняя оценка'},{v:data.likes||0,l:'Реакций на оценки'}];
      stats.forEach((stat,index)=>{
        const x=32+index*184;
        ctx.fillStyle='#f4fbf7';fitted(ctx,stat.v,x,215,162,36);
        ctx.fillStyle='#b9c9c2';ctx.font='12px "Onest Variable",sans-serif';ctx.fillText(stat.l,x,243);
      });
      ctx.fillStyle='#91e6cc';ctx.font='600 16px "Onest Variable",sans-serif';
      const activity=FBZDomain.profileActivity(Number(data.ratings)||0).label;
      ctx.fillText(activity,32,303);
      canvas.setAttribute('aria-label',`${data.name||data.username||'Болельщик'}. ${activity}. Средняя оценка ${data.avg||'не указана'}.`);
    }else{
      ctx.fillStyle='#f4fbf7';ctx.font='650 23px "Onest Variable",sans-serif';
      lines(ctx,data.match,536,2).forEach((line,index)=>ctx.fillText(line,32,101+index*30));
      const score=FBZDomain.ratingPresentation(data.score);
      const colors={low:'#ffaaaa',mid:'#ffcf80',high:'#8eeac0',elite:'#8fdcff',neutral:'#f4fbf7'};
      ctx.fillStyle=colors[score.tone];ctx.font='650 68px "Onest Variable",sans-serif';ctx.fillText(score.label,32,215);
      ctx.fillStyle='#dce7e1';ctx.font='15px "Onest Variable",sans-serif';
      lines(ctx,data.comment,536,3).forEach((line,index)=>ctx.fillText(line,32,258+index*22));
      ctx.fillStyle='#b9c9c2';ctx.font='13px "Onest Variable",sans-serif';ctx.textAlign='right';ctx.fillText('@'+String(data.username||'user').slice(0,32),568,374);ctx.textAlign='left';
      canvas.setAttribute('aria-label',`${data.match||'Матч'}. Оценка ${score.label}. ${data.comment||''}`);
    }
    document.getElementById('shareTitle').textContent=type==='profile'?'Карточка профиля':'Моя оценка матча';
    root.FBZOverlay.open('shareOv','.share-box button');
  }
  function close(){version++;root.FBZOverlay.close('shareOv');}
  function download(){
    const link=document.createElement('a');link.download='footbazed-card.png';link.href=document.getElementById('shareCanvas').toDataURL('image/png');link.click();
  }
  async function copy(){
    try{
      const blob=await new Promise(resolve=>document.getElementById('shareCanvas').toBlob(resolve,'image/png'));
      if(!blob)throw new Error('Image unavailable');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);root.toast('Карточка скопирована','ok');
    }catch{download();root.toast('Карточка сохранена как изображение','ok');}
  }
  root.FBZShare=Object.freeze({open,close,download,copy});
})(window);
