(function(root){
'use strict';
function parse(day){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day||''));
  if(!m||Number(m[1])<1000)return null;
  const date=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return date.getFullYear()===Number(m[1])&&date.getMonth()===Number(m[2])-1&&date.getDate()===Number(m[3])?date:null;
}
function key(date=new Date()){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function exact(value){
  const parts=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(value||'').trim());
  const day=parts?`${parts[3]}-${parts[2]}-${parts[1]}`:null;
  return parse(day)?day:null;
}
function formatted(day){return parse(day)?day.slice(8)+'.'+day.slice(5,7)+'.'+day.slice(0,4):'';}
function shift(day,amount){
  const date=parse(day);if(!date||!Number.isInteger(amount))return null;
  date.setDate(date.getDate()+amount);return parse(key(date))?key(date):null;
}
function bounds(day){
  const start=parse(day);if(!start)return null;
  const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+1);
  return {from:start.toISOString(),until:end.toISOString()};
}
function month(day,amount=0){
  const date=parse(day);if(!date||!Number.isInteger(amount))return null;
  date.setDate(1);date.setMonth(date.getMonth()+amount);return parse(key(date))?key(date):null;
}
function monthDays(day){
  const first=parse(month(day));if(!first)return [];
  const offset=(first.getDay()+6)%7,start=key(first);
  return Array.from({length:42},(_,index)=>shift(start,index-offset));
}
function yearRange(first,last,now=new Date()){
  const current=now.getFullYear(),start=new Date(first),end=new Date(last);
  const valid=typeof first==='string'&&typeof last==='string'&&Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&start<=end;
  const from=valid?Math.max(1000,Math.min(current,start.getFullYear())):current;
  const until=valid?Math.max(from,Math.min(current,end.getFullYear())):current;
  return {from,until,min:`${from}-01-01`,max:`${until}-12-31`};
}
function within(day,range){return Boolean(parse(day)&&range&&day>=range.min&&day<=range.max);}
function clamp(day,range){return parse(day)?day<range.min?range.min:day>range.max?range.max:day:range.min;}
const api=Object.freeze({parse,key,exact,formatted,shift,bounds,month,monthDays,yearRange,within,clamp});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FBZCalendarModel=api;
})(globalThis);
