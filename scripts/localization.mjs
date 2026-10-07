import {readFileSync,readdirSync} from 'node:fs';
import {Script} from 'node:vm';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createScanner,SyntaxKind} from 'typescript/unstable/ast';

export const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
export const localeSources=['index.html','admin.html','app.js',...readdirSync(resolve(projectRoot,'js')).filter(name=>name.endsWith('.js')).map(name=>'js/'+name)];
const cyrillic=/[А-Яа-яЁё]/u;
// Translate authored literal text only. Expressions, user content, identifiers,
// regular expressions and provider aliases are never passed through translation.
export function literalRanges(source,file){
  if(['js/football-names.js','js/locale.js'].includes(file))return [];
  if(file.endsWith('.html'))return [[0,source.length]];
  const scanner=createScanner(true,undefined,source),ranges=[],templates=[];
  let previous;
  for(let kind=scanner.scan();kind!==SyntaxKind.EndOfFile;kind=scanner.scan()){
    if(kind===SyntaxKind.SlashToken&&[SyntaxKind.EqualsToken,SyntaxKind.OpenParenToken,SyntaxKind.CommaToken,SyntaxKind.ColonToken,SyntaxKind.ReturnKeyword,SyntaxKind.EqualsGreaterThanToken].includes(previous))kind=scanner.reScanSlashToken();
    if(kind===SyntaxKind.OpenBraceToken&&templates.length)templates[templates.length-1]++;
    if(kind===SyntaxKind.CloseBraceToken&&templates.length){
      if(templates[templates.length-1]===0)kind=scanner.reScanTemplateToken(false);
      else templates[templates.length-1]--;
    }
    if([SyntaxKind.StringLiteral,SyntaxKind.NoSubstitutionTemplateLiteral,SyntaxKind.TemplateHead,SyntaxKind.TemplateMiddle,SyntaxKind.TemplateTail].includes(kind)){
      const start=scanner.getTokenStart(),end=scanner.getTokenEnd();
      // Identity aliases are intentionally bilingual in every UI language.
      const swatchStart=source.indexOf('const CLUB_SWATCHES='),swatchEnd=source.indexOf(".split('\\n')",swatchStart);
      const objectKey=[SyntaxKind.OpenBraceToken,SyntaxKind.CommaToken].includes(previous)&&scanner.lookAhead(()=>scanner.scan())===SyntaxKind.ColonToken;
      const wireConstant=kind===SyntaxKind.StringLiteral&&(objectKey||[SyntaxKind.EqualsEqualsEqualsToken,SyntaxKind.ExclamationEqualsEqualsToken].includes(previous));
      if(!wireConstant&&!(swatchStart>=0&&start>=swatchStart&&end<=swatchEnd))ranges.push([start+1,end-([SyntaxKind.TemplateHead,SyntaxKind.TemplateMiddle].includes(kind)?2:1),kind===SyntaxKind.StringLiteral?source[start]:'`']);
      if(kind===SyntaxKind.TemplateHead)templates.push(0);
      if(kind===SyntaxKind.TemplateTail)templates.pop();
    }
    previous=kind;
  }
  return ranges;
}
export function phrases(text){
  return [...text.matchAll(/[А-Яа-яЁё][^<>"'`$\{\}\\\r\n|]*/gu)].map(match=>({text:match[0].trimEnd(),offset:match.index})).filter(item=>cyrillic.test(item.text));
}
export function inventory(){
  const items=new Map();
  for(const file of localeSources){
    const source=readFileSync(resolve(projectRoot,file),'utf8');
    for(const [start,end] of literalRanges(source,file))for(const item of phrases(source.slice(start,end))){
      if(!items.has(item.text))items.set(item.text,new Set());
      items.get(item.text).add(file);
    }
  }
  return [...items].map(([text,files])=>({text,files:[...files]}));
}
export function englishSource(source,file,catalog){
  const replacements=[];
  for(const [start,end,quote] of literalRanges(source,file))for(const item of phrases(source.slice(start,end))){
    if(!Object.hasOwn(catalog,item.text))throw new Error(`Missing English text in ${file}: ${item.text}`);
    let text=catalog[item.text];
    if(file.endsWith('.js')){
      text=text.replaceAll('\\','\\\\').replaceAll(quote,'\\'+quote).replaceAll('\r','\\r').replaceAll('\n','\\n');
      if(quote==='`')text=text.replaceAll('${','\\${');
    }
    replacements.push({start:start+item.offset,end:start+item.offset+item.text.length,text});
  }
  for(const item of replacements.reverse())source=source.slice(0,item.start)+item.text+source.slice(item.end);
  if(file.endsWith('.js')){
    source=source.replaceAll("'ru-RU'","'en-GB'");
    new Script(source,{filename:file+' (English)'});
  }
  return source;
}
export function englishResource(source,file,catalog){
  let result=englishSource(source,file,catalog);
  if(file.endsWith('.html')){
    result=result.replace('<html lang="ru">','<html lang="en">')
      .replace(/(<script[^>]* src=")(\/?(?:js\/|app\.js)[^"]+)(")/gu,(_,a,p,b)=>a+'/en-assets/'+p.replace(/^\//u,'')+b)
      .replace(/(<link rel="canonical" href="https:\/\/footbazed47\.vercel\.app)\/(")/gu,'$1/en$2')
      .replace(/(<meta property="og:url" content="https:\/\/footbazed47\.vercel\.app)\/(")/gu,'$1/en$2')
      .replace(/(<a\b[^>]* href=")\/(?:index\.html)?(")/gu,'$1/en$2')
      .replace(/(<a\b[^>]* href=")\/admin(")/gu,'$1/en/admin$2');
  }
  return result;
}
