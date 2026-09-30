import {readFile,writeFile} from 'node:fs/promises';

// Hosted MCP and the pinned local postgres-meta generator differ only in these
// formatting details and transport metadata. Preserve every schema field.
export function normalizeDatabaseTypes(source){
  return source.replace(/  \/\/ Allows to automatically instantiate createClient with right options\r?\n  \/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\r?\n  __InternalSupabase: \{\r?\n    PostgrestVersion: "[^"\r\n]+"\r?\n  \}\r?\n/u,'')
    .replace(/(  (?:TableName|EnumName|CompositeTypeName) extends) \(([\s\S]*?: never)\) = never,/gu,'$1 $2 = never,')
    .replace(/\r\n/gu,'\n').trimEnd()+'\n\n';
}

if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\','/').split('/').at(-1))){
  const path=process.argv[2];if(!path)throw new Error('Database types path required');
  await writeFile(path,normalizeDatabaseTypes(await readFile(path,'utf8')),'utf8');
}
