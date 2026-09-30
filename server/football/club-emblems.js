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
  ['barcelona','barca'],['parissaintgermain','psg'],['atleticomadrid','clubatleticodemadrid'],
  ['athleticclub','athleticbilbao'],['realbetis','realbetisbalompie'],['celtavigo','celtadevigo','celta'],
  ['sevilla','sevillafc'],['osasuna','caosasuna'],['realvalladolid','realvalladolidde'],
  ['inter','internazionale','internazionalemilano'],['acmilan','milan'],['asroma','roma'],
  ['lazio','sslazio'],['napoli','sscnapoli'],['atalanta','atalantabc'],['torino','torinofc'],
  ['bayerleverkusen','bayer04leverkusen','leverkusen'],['bayernmunchen','bayernmunich','bayern'],
  ['borussiadortmund','dortmund'],['borussiamonchengladbach','borussiamgladbach','gladbach'],
  ['mainz05','mainz','1fsvmainz05'],['fcstpauli','stpauli'],['heidenheim','1fcheidenheim1846'],
  ['eintrachtfrankfurt','frankfurt'],['unionberlin','1fcunionberlin'],['vflwolfsburg','wolfsburg'],
  ['vfbstuttgart','vfbstuttgart1893','stuttgart'],
  ['olympiquemarseille','olympiquedemarseille','marseille'],['olympiquelyonnais','lyon'],
  ['paris','parisfc'],['staderennes','staderennais1901','rennes'],['stadebrestois29','brest'],
  ['lille','lilleosc'],['lehavre','lehavreac'],['saintetienne','asse'],
  ['sporting','sportingcp','sportingclubedeportugal'],['bodoglimt'],
  ['clubbrugge','clubbruggekv'],['redbullsalzburg','rbsalzburg','salzburg']
]);
function nameKey(value){
  const name=normalizedName(value);
  return aliases.find(group=>group.some(alias=>normalizedName(alias)===name))?.[0]||name;
}
function countryKey(value){
  const key=normalizedName(value);
  return ({germany:'germany',deutschland:'germany',espana:'spain',italia:'italy'})[key]||key;
}

function matchClubEmblems(providerItems,clubs,mappings=[]){
  if(!Array.isArray(providerItems)||!providerItems.length||providerItems.length>120||!Array.isArray(clubs)||clubs.length>500)throw new FootballProviderError('provider_invalid_teams');
  const seen=new Set(),usedClubs=new Set(),items=[],skipped=[];
  for(const row of providerItems){
    const team=row?.team;
    if(!team||!Number.isSafeInteger(team.id)||team.id<=0||typeof team.name!=='string'||!team.name.trim()||team.name.length>160||typeof team.country!=='string'||!team.country.trim()||team.country.length>100||typeof team.logo!=='string'||team.logo!==`https://media.api-sports.io/football/teams/${team.id}.png`||seen.has(team.id))throw new FootballProviderError('provider_invalid_teams');
    seen.add(team.id);
    const mapped=mappings.find(m=>Number(m.external_id)===team.id);
    const candidates=clubs.filter(club=>countryKey(club.area_name)===countryKey(team.country)&&
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

module.exports={matchClubEmblems,prepareClubEmblems};
