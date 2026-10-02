'use strict';

const {FootballProviderError,PILOT_COMPETITIONS}=require('./api-football');
const TERMS_URL='https://www.api-football.com/terms';

function normalizedName(value){
  return String(value||'').replace(/ø/giu,'o').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
    .replace(/\b(?:fc|cf|afc|ac|sc|rc|bc|ca|ud|cd|fk|as|ssc)\b/gu,'').replace(/[^a-z0-9]/gu,'');
}
// Name aliases are explicit; provider numeric IDs are always read from the API.
const aliases=Object.freeze([
  ['manchesterunited','manunited'],['manchestercity','mancity'],
  ['brighton','brightonhove','brightonhovealbion'],['nottinghamforest','nottingham'],
  ['tottenham','tottenhamhotspur'],['newcastle','newcastleunited'],
  ['ipswich','ipswichtown'],['leeds','leedsunited'],
  ['barcelona','barca'],['parissaintgermain','psg'],['atleticomadrid','clubatleticodemadrid'],
  ['athleticclub','athleticbilbao'],['realbetis','realbetisbalompie'],['celtavigo','celtadevigo','celta'],
  ['sevilla','sevillafc'],['osasuna','caosasuna'],['realvalladolid','realvalladolidde'],
  ['inter','internazionale','internazionalemilano'],['acmilan','milan'],['asroma','roma'],
  ['lazio','sslazio'],['napoli','sscnapoli'],['atalanta','atalantabc'],['torino','torinofc'],
  ['como','como1907'],
  ['bayerleverkusen','bayer04leverkusen','leverkusen'],['bayernmunchen','bayernmunich','bayern'],
  ['borussiadortmund','dortmund'],['borussiamonchengladbach','borussiamgladbach','gladbach'],
  ['mainz05','mainz','fsvmainz05','1fsvmainz05'],['fcstpauli','stpauli'],['heidenheim','1fcheidenheim1846'],
  ['werderbremen','svwerderbremen'],['hoffenheim','1899hoffenheim','tsg1899hoffenheim'],
  ['elversberg','svelversberg','sv07elversberg'],['koln','1koln','1fckoln','cologne'],
  ['eintrachtfrankfurt','frankfurt'],['unionberlin','1fcunionberlin'],['vflwolfsburg','wolfsburg'],
  ['vfbstuttgart','vfbstuttgart1893','stuttgart'],
  ['olympiquemarseille','olympiquedemarseille','marseille'],['olympiquelyonnais','lyon'],
  ['paris','parisfc'],['staderennes','staderennais1901','rennes'],['stadebrestois29','brest'],
  ['lille','lilleosc'],['lehavre','lehavreac'],['saintetienne','asse'],
  ['angers','angerssco'],['psv','psveindhoven'],['slovanbratislava','skslovanbratislava'],
  ['troyes','estactroyes','estroyes'],
  ['sporting','sportingcp','sportingclubedeportugal'],['bodoglimt'],
  ['clubbrugge','clubbruggekv'],['redbullsalzburg','rbsalzburg','salzburg'],
  ['lask','lasklinz'],['aek','aekathens','paeaek'],
  ['coventrycity','coventry'],['realracingclubdesantander','racingsantander','santander'],
  ['deportivolacoruna','deportivo'],['sabah','sabahfa']
]);
function nameKey(value){
  const name=normalizedName(value);
  return aliases.find(group=>group.some(alias=>normalizedName(alias)===name))?.[0]||name;
}
function countryKey(value){
  const key=normalizedName(value);
  return ({germany:'germany',deutschland:'germany',espana:'spain',italia:'italy',azerbaidjan:'azerbaijan'})[key]||key;
}
// Exact, country-scoped historical dates documented by the clubs themselves.
// They identify predecessor/merger dates; never rewrite the legacy catalogue.
const historicalFoundations=Object.freeze({
  'malaga:spain':{years:[1933,1948,1994],source:'https://www.malagacf.com/1941-1992-club-deportivo-malaga'},
  'paderborn07:germany':{years:[1907,1908,1985],source:'https://www.scp07.de/SCP07/Der-Verein/Chronik/'}
});
function foundingEvidence(club,team){
  if(club.founded==null||team.founded==null||Number(club.founded)===Number(team.founded))return {matches:true};
  const history=historicalFoundations[nameKey(club.name)+':'+countryKey(club.area_name)];
  if(history?.years.includes(Number(club.founded))&&history.years.includes(Number(team.founded)))return {matches:true,source:history.source};
  return {matches:false};
}
function sameCountry(club,team){
  const local=countryKey(club.area_name),remote=countryKey(team.country);
  if(local===remote)return true;
  // AS Monaco is classified by its home country in one catalogue and its league country in the other.
  return local==='monaco'&&remote==='france'&&nameKey(club.name)==='monaco'&&nameKey(team.name)==='monaco';
}

function matchClubEmblems(providerItems,clubs,mappings=[]){
  if(!Array.isArray(providerItems)||!providerItems.length||providerItems.length>120||!Array.isArray(clubs)||clubs.length>500)throw new FootballProviderError('provider_invalid_teams');
  const seen=new Set(),usedClubs=new Set(),items=[],skipped=[];
  for(const row of providerItems){
    const team=row?.team;
    if(!team||!Number.isSafeInteger(team.id)||team.id<=0||typeof team.name!=='string'||!team.name.trim()||team.name.length>160||typeof team.country!=='string'||!team.country.trim()||team.country.length>100||typeof team.logo!=='string'||team.logo!==`https://media.api-sports.io/football/teams/${team.id}.png`||seen.has(team.id))throw new FootballProviderError('provider_invalid_teams');
    seen.add(team.id);
    const mapped=mappings.find(m=>Number(m.external_id)===team.id);
    const candidates=clubs.filter(club=>sameCountry(club,team)&&
      [club.name,club.short_name].some(name=>nameKey(name)===nameKey(team.name)));
    const club=mapped?clubs.find(c=>Number(c.id)===Number(mapped.club_id)):candidates.length===1?candidates[0]:null;
    const conflicting=club&&mappings.some(m=>Number(m.club_id)===Number(club.id)&&Number(m.external_id)!==team.id);
    if(!club||conflicting||usedClubs.has(Number(club.id))||(mapped&&!candidates.some(c=>Number(c.id)===Number(club.id)))){
      skipped.push({providerName:team.name,reason:conflicting?'mapping_conflict':candidates.length>1?'ambiguous':'no_match'});continue;
    }
    usedClubs.add(Number(club.id));
    items.push({club_id:Number(club.id),legacy_external_id:Number(club.external_id),club_name:club.name,provider_id:team.id,provider_name:team.name,country:team.country,source_url:team.logo});
  }
  return {items,skipped,received:providerItems.length};
}

async function prepareClubEmblems(client,league,season,clubs,mappings){
  if(!Object.hasOwn(PILOT_COMPETITIONS,league))throw new FootballProviderError('invalid_provider_parameters',400);
  const result=await client.collection('/teams',{league:PILOT_COMPETITIONS[league],season},{maxPages:1,maxItems:120});
  const matched=matchClubEmblems(result.items,clubs,mappings);
  return {...matched,league,season,quota:result.quota,termsUrl:TERMS_URL};
}

async function prepareMissingClubEmblem(client,club,mappings=[]){
  if(!club||!Number.isSafeInteger(Number(club.id))||Number(club.id)<1||club.logo_asset_id!=null)throw new FootballProviderError('club_emblem_not_missing',400);
  const searchName=normalizedName(club.short_name)==='deportivo'?club.name:club.short_name||club.name;
  const cleanName=String(searchName||'').normalize('NFKD').replace(/\p{M}/gu,'')
    .replace(/\b(?:fc|cf|afc|ac|sc|rc|bc|ca|ud|cd|fk|as|ssc)\b/giu,'').replace(/\s+/gu,' ').trim();
  const words=cleanName.split(' '),generic=/^(?:real|racing|man|manchester|united|city|le|la|les|stade|sporting)$/iu;
  const query=normalizedName(club.short_name)==='deportivo'?cleanName:words[0].length>=3&&!generic.test(words[0])?words[0]:words.slice(0,2).join(' ');
  if(query.length<3||query.length>80)throw new FootballProviderError('invalid_provider_parameters',400);
  const result=await client.collection('/teams',{search:query},{maxPages:1,maxItems:120});
  const eligible=[],skipped=[],seen=new Set();
  // Search spans countries and may include national or similarly named teams.
  // Check every result independently, then refuse multiple exact identities.
  for(const row of result.items){
    if(seen.has(row?.team?.id))throw new FootballProviderError('provider_invalid_teams');seen.add(row?.team?.id);
    const details={country:String(row?.team?.country||'').slice(0,100),localFounded:club.founded,providerFounded:Number.isSafeInteger(row?.team?.founded)?row.team.founded:null};
    if(row?.team?.national!==false){skipped.push({providerName:String(row?.team?.name||'').slice(0,160),reason:'not_club',...details});continue;}
    const matched=matchClubEmblems([row],[club],mappings);
    skipped.push(...matched.skipped.map(item=>({...item,...details})));
    if(!matched.items.length)continue;
    const foundation=foundingEvidence(club,row.team);
    if(!foundation.matches){skipped.push({providerName:row.team.name,reason:'identity_conflict',...details});continue;}
    eligible.push(...matched.items.map(item=>({...item,...(foundation.source?{identity_evidence:{source:foundation.source,local_founded:club.founded,provider_founded:row.team.founded}}:{})})));
  }
  const unique=new Map(eligible.map(item=>[item.provider_id,item]));
  const items=unique.size===1?[...unique.values()]:[];
  if(unique.size>1)skipped.push(...[...unique.values()].map(item=>({providerName:item.provider_name,reason:'ambiguous'})));
  return {items,skipped,received:result.items.length,lookup:'team-search',query,league:null,season:null,quota:result.quota,termsUrl:TERMS_URL};
}

module.exports={matchClubEmblems,prepareClubEmblems,prepareMissingClubEmblem};
