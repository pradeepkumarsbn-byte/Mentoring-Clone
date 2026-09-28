import fs from 'node:fs';
import {parseEnv,isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {prepareImport,projectRef} from './migration-data.mjs';
const env=parseEnv(fs.readFileSync(process.argv[2]||'../../../../.env','utf8'));
const snapshot=JSON.parse(fs.readFileSync('.migration-private/source-sheet.json','utf8'));
const exported=JSON.parse(fs.readFileSync('.migration-private/app-state.json','utf8'));
let client,stage='audit';
try{
 const prepared=prepareImport(snapshot,exported.state);
 console.log(JSON.stringify({audit:'passed',counts:prepared.counts,access:prepared.access.length}));
 if(!process.argv.includes('--import'))process.exit(0);
 stage='target validation';
 if(env.MENTORING_SUPABASE_URL!==`https://${projectRef}.supabase.co`)throw Error('Target mismatch');
 const url=new URL(env.MENTORING_DATABASE_URL);
 if(!(['postgres:','postgresql:'].includes(url.protocol))||!(url.hostname===`db.${projectRef}.supabase.co`||(url.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(url.username)===`postgres.${projectRef}`)))throw Error('Target mismatch');
 stage='database connection';
 client=new pg.Client({connectionString:env.MENTORING_DATABASE_URL,connectionTimeoutMillis:15000,statement_timeout:30000});await client.connect();
 stage='schema migration';
 await client.query('begin');
 await client.query('create schema if not exists mentoring_private; revoke all on schema mentoring_private from public,anon,authenticated; create table if not exists mentoring_private.migrations(name text primary key,sha256 text not null)');
 for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()){
  const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');const hash=createHash('sha256').update(sql).digest('hex');
  const {rows}=await client.query('select sha256 from mentoring_private.migrations where name=$1',[name]);
  if(rows.length){if(rows[0].sha256!==hash)throw Error('Migration checksum changed');continue;}
  await client.query(sql.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,''));
  await client.query('insert into mentoring_private.migrations values($1,$2)',[name,hash]);
 }
 stage='empty target check';
 const existing=await client.query('select (select count(*) from public.mentoring_records)+(select count(*) from public.mentoring_access) as n');
 if(Number(existing.rows[0].n)!==0)throw Error('Target contains records; refusing overwrite');
 stage='record import';
 for(const r of prepared.records)await client.query('insert into public.mentoring_records(kind,id,data) values($1,$2,$3)',[r.kind,r.id,JSON.stringify(r.data)]);
 for(const a of prepared.access)await client.query('insert into public.mentoring_access(email,name,role,active,source) values($1,$2,$3,$4,$5)',[a.email,a.name,a.role,a.active,JSON.stringify(a.source)]);
 await client.query('insert into mentoring_private.source_snapshots(source_id,payload) values($1,$2)',[snapshot.spreadsheetId,JSON.stringify({raw:snapshot,application:exported})]);
 stage='exact verification';
 const actual=(await client.query('select kind,id,data from public.mentoring_records order by kind,id')).rows;
 const sort=rows=>[...rows].sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
 if(!isDeepStrictEqual(sort(actual),sort(prepared.records)))throw Error('Record mismatch');
 const access=(await client.query('select email,name,role,active,source from public.mentoring_access order by email')).rows;
 if(!isDeepStrictEqual(access,[...prepared.access].sort((a,b)=>a.email.localeCompare(b.email))))throw Error('Access mismatch');
 await client.query('commit');
 fs.writeFileSync('.migration-private/import-report.json',JSON.stringify({projectRef,completedAt:new Date().toISOString(),counts:prepared.counts,access:prepared.access.length,exactComparison:true},null,2));
 console.log('Import committed. Every imported record and access entry matches the source.');
}catch(e){if(client)await client.query('rollback').catch(()=>{});console.error(`Stopped at ${stage}. No partial import committed. Code: ${String(e.code||'validation').replace(/[^A-Za-z0-9_]/g,'')}`);process.exitCode=1;}finally{if(client)await client.end().catch(()=>{});}
