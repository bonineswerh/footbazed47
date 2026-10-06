'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const names=require('../js/football-names.js'),domain=require('../js/domain.js'),seo=require('../js/seo.js');
const {routeFromPath,resolvePage,renderDocument}=require('../api/page.js');
const {buildSitemap}=require('../api/sitemap.js');
const catalog=require('../locales/en.json');
test('authored text compiler covers every source and fails on missing translations',async()=>{
  const compiler=await import('../scripts/localization.mjs');
  for(const file of compiler.localeSources)assert.doesNotThrow(()=>compiler.englishResource(fs.readFileSync(compiler.projectRoot+'/'+file,'utf8'),file,catalog));
  assert.throws(()=>compiler.englishSource('const title="Нет перевода";','sample.js',catalog),/Missing English text/);
  const russianHome=fs.readFileSync(compiler.projectRoot+'/index.html','utf8');
  const home=compiler.englishResource(russianHome,'index.html',catalog);
  assert.match(home,/<base href="\/">/);
  assert.match(home,/<link rel="canonical" href="https:\/\/footbazed47.vercel.app\/en">/);
  for(const document of [russianHome,home]){
    assert.equal((document.match(/hreflang=/gu)||[]).length,3);
    assert.match(document,/hreflang="ru" href="https:\/\/footbazed47.vercel.app\/"/);
    assert.match(document,/hreflang="en" href="https:\/\/footbazed47.vercel.app\/en"/);
    assert.match(document,/hreflang="x-default" href="https:\/\/footbazed47.vercel.app\/"/);
  }
  const admin=compiler.englishResource(fs.readFileSync(compiler.projectRoot+'/admin.html','utf8'),'admin.html',catalog);
  assert.match(admin,/src="\/en-assets\/js\/admin-redirect.js/);
  assert.match(admin,/href="\/en\/admin"/);
});
test('compiler preserves user content, identity keys, regexes and wire constants',async()=>{
  const {englishSource}=await import('../scripts/localization.mjs');
  const source='const keys={"Матч":"Оценки"}; const expression=/Матч/; const comparison=value==="Матч"; const output=\`Оценки: \${value} \${\`Матч \${1}\`}\`;';
  const compiled=englishSource(source,'sample.js',{'Оценки':'Ratings','Оценки:':'Ratings:','Матч':'Match'});
  const result=vm.runInNewContext(compiled+'; ({keys,expression,comparison,output})',{value:'Текст болельщика'});
  assert.equal(result.keys['Матч'],'Ratings');assert.equal(result.expression.source,'Матч');
  assert.equal(result.comparison,false);assert.equal(result.output,'Ratings: Текст болельщика Match 1');
  assert.equal(vm.runInNewContext(englishSource('true?"Матч":"Оценки"','sample.js',{'Матч':'Match','Оценки':'Ratings'})),'Match');
});
test('curated club labels keep identities, full names, palettes and unknowns',()=>{
  assert.equal(names.club('Manchester City FC'),'Ман Сити');
  assert.equal(names.club('Manchester City FC','',true),'Манчестер Сити');
  assert.equal(names.club('Манчестер Сити','','', 'en'),'Man City');
  assert.equal(names.club('Real Madrid CF','','', 'en'),'Real Madrid');
  assert.equal(names.club('SC Paderborn'),'Падерборн');assert.equal(names.club('Olympique Lyon'),'Лион');
  assert.equal(names.club('Unlisted United'),'Unlisted United');
  assert.equal(names.matchTitle('Real Madrid CF — Manchester City FC'),'Реал Мадрид — Ман Сити');
  assert.equal(names.competition({code:'PD',name:'La Liga'}),'Ла Лига');
  assert.deepEqual(domain.clubPalette('Atlético Madrid'),domain.clubPalette('Club Atlético de Madrid'));
});
test('English public metadata, alternate languages and sitemap agree without querying profiles',async()=>{
  const staticPage=await resolvePage(routeFromPath('/en/matches'),{});
  assert.equal(staticPage.metadata.path,'/en/matches');assert.match(staticPage.metadata.title,/Matches/);
  assert.equal(seo.forLanguage('en').club({id:24,name:'Real Madrid CF'}).path,'/en/club/24');
  const profile=await resolvePage(routeFromPath('/en/profile/3615141a-7700-46b8-9ba5-e4f4450537fc'),{},()=>{throw Error('No private lookup');});
  assert.equal(profile.metadata.index,false);
  const html=renderDocument(fs.readFileSync(require.resolve('../index.html'),'utf8'),staticPage.metadata);
  assert.equal((html.match(/hreflang=/gu)||[]).length,3);
  assert.match(html,/hreflang="ru" href="https:\/\/footbazed47.vercel.app\/matches"/);
  assert.match(html,/hreflang="en" href="https:\/\/footbazed47.vercel.app\/en\/matches"/);
  const sitemap=buildSitemap({clubs:[{id:24}]});
  assert.match(sitemap,/\/en\/club\/24<\/loc>/);assert.match(sitemap,/xmlns:xhtml/);
});
