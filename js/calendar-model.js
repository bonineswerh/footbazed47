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
function shift(day,amount){
  const date=parse(day);if(!date||!Number.isInteger(amount))return null;
  date.setDate(date.getDate()+amount);return parse(key(date))?key(date):null;
}
function bounds(day){
  const start=parse(day);if(!start)return null;
  const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+1);
  return {from:start.toISOString(),until:end.toISOString()};
}
const api=Object.freeze({parse,key,shift,bounds});
if(typeof module==='object'&&module.exports)module.exports=api;
else root.FBZCalendarModel=api;
})(globalThis);
