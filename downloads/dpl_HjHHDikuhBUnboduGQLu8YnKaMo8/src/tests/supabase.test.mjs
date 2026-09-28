import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {applyStatePatch} from '../app/state-patch.ts';
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
await db.exec(readFileSync(new URL('../supabase/migrations/202609270001_mentoring.sql',import.meta.url),'utf8'));
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;`);
await db.exec(readFileSync(new URL('../supabase/migrations/202609270002_storage.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/202609280003_cutover.sql',import.meta.url),'utf8'));
const admin='00000000-0000-0000-0000-000000000001',mentor='00000000-0000-0000-0000-000000000002',stranger='00000000-0000-0000-0000-000000000003';
await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$6,now())',[admin,'admin@example.com',mentor,'mentor@example.com',stranger,'stranger@example.com']);
async function seed(){await db.exec('reset role; truncate public.mentoring_records,public.mentoring_access,mentoring_private.requests');await db.exec(`insert into public.mentoring_access(email,name,role,active) values ('admin@example.com','Admin','admin',true),('mentor@example.com','Mentor','mentor',true)`);for(const [kind,id,data] of [['mentors','m',{name:'Mentor',initials:'M',tone:'green'}],['programTypes','t',{name:'DYS0'}],['programTypes','t2',{name:'DYS1'}],['websiteContent','hero',{value:'Hello'}]])await db.query('insert into public.mentoring_records(kind,id,data) values ($1,$2,$3)',[kind,id,JSON.stringify({id,...data})]);await user(admin);}
async function user(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function mutate(body,id=crypto.randomUUID()){return (await db.query('select public.mentoring_mutate($1,$2) as value',[JSON.stringify(body),id])).rows[0].value;}
async function state(){return (await db.query('select public.mentoring_state() as value')).rows[0].value;}
const newBoy=()=>mutate({action:'add_boy',name:'Boy',mentorId:'m',hostel:'1',floor:'B0',status:'Active'});
const newProgram=(type='t')=>mutate({action:'add_program',programTypeId:type,date:'2026-09-27',venue:'Hall'});
test('all data reads require an approved, confirmed user; no direct writes',async()=>{await seed();await user(stranger);await assert.rejects(state,/Access denied/);assert.equal((await db.query('select * from public.mentoring_records')).rows.length,0);await assert.rejects(()=>newBoy(),/Access denied/);await user(mentor);await assert.rejects(()=>db.exec("delete from public.mentoring_records"),/permission denied/);assert.equal((await state()).viewer.role,'mentor');});
test('boy create, drop, profile edit preserve location and existing fields; idempotent saves',async()=>{await seed();const id=crypto.randomUUID(),body={action:'add_boy',name:'Boy',mentorId:'m',hostel:'1',floor:'B0',status:'Active'};const first=await mutate(body,id);assert.deepEqual(await mutate(body,id),first);const boy=first.upserts[0].record;assert.equal((await state()).boys.length,1);await assert.rejects(()=>mutate({...body,name:'different'},id),/already used/);const r=await mutate({action:'update_boy',boyId:boy.id,mentorId:'m',hostel:'1',floor:'B0',status:'Dropped',comment:'Follow up'});assert.equal(r.upserts[0].record.status,'Dropped');assert.equal(r.upserts[0].record.floor,'B0');assert.equal(r.upserts[0].record.createdBy,'admin@example.com');await assert.rejects(()=>mutate({action:'update_boy',boyId:boy.id,mentorId:'m',floor:'B12',hostel:'1'}),/Select a floor/);});
test('attendance/invitation upserts, validation and dependent deletes are atomic',async()=>{await seed();const boyId=(await newBoy()).upserts[0].record.id;const programId=(await newProgram()).upserts[0].record.id;await assert.rejects(()=>mutate({action:'set_attendance',boyId,programId,status:'Absent'}),/Absence reason/);await mutate({action:'set_attendance',boyId,programId,status:'Present',updatedBy:'spoof'});await mutate({action:'set_attendance',boyId,programId,status:'Late',reason:''});await mutate({action:'set_invitation',boyId,programId,response:'Coming'});await mutate({action:'set_invitation',boyId,programId,response:'Maybe'});let s=await state();assert.equal(s.attendance.length,1);assert.equal(s.invitations.length,1);assert.equal(s.attendance[0].updatedBy,'admin@example.com');const patch=await mutate({action:'delete_program',programId});s=applyStatePatch(s,patch);assert.equal(s.programs.length,0);assert.equal(s.attendance.length,0);assert.equal(s.invitations.length,0);assert.equal((await state()).attendance.length,0);});
test('duplicate attendance across dates is rejected, including type reassignment',async()=>{await seed();const boyId=(await newBoy()).upserts[0].record.id;const p1=(await newProgram()).upserts[0].record.id,p2=(await newProgram()).upserts[0].record.id,p3=(await newProgram('t2')).upserts[0].record.id;await mutate({action:'set_attendance',boyId,programId:p1,status:'Present'});await assert.rejects(()=>mutate({action:'set_attendance',boyId,programId:p2,status:'Present'}),/already Present/);await mutate({action:'set_attendance',boyId,programId:p3,status:'Present'});await assert.rejects(()=>mutate({action:'update_program',programId:p3,programTypeId:'t',date:'2026-09-27'}),/duplicate Present/);assert.equal((await state()).programs.find(p=>p.id===p3).programTypeId,'t2');});
test('admin-only calendar/theme/content/access management and last admin protection',async()=>{await seed();await user(mentor);await assert.rejects(()=>mutate({action:'update_website_content',values:{hero:'bad'}}),/Only an Admin/);await assert.rejects(()=>mutate({action:'manage_record',kind:'access',id:'other@example.com',values:{role:'admin',active:true}}),/Admin access/);await user(admin);await mutate({action:'manage_record',kind:'calendarEvents',id:'event',values:{title:'Camp',startDate:'2026-10-01',endDate:'2026-10-02'}});await mutate({action:'manage_record',kind:'websiteSettings',id:'brand_title',values:{value:'Mentoring'}});await mutate({action:'update_website_content',values:{hero:'New'}});let s=await state();assert.equal(s.calendarEvents[0].title,'Camp');assert.equal(s.websiteSettings.brand_title,'Mentoring');assert.equal(s.websiteContent.hero,'New');await assert.rejects(()=>mutate({action:'manage_record',kind:'access',id:'admin@example.com',values:{name:'Admin',role:'mentor',active:true}}),/at least one/);await assert.rejects(()=>mutate({action:'delete_managed_record',kind:'access',id:'admin@example.com'}),/at least one/);});
test('patches preserve unrelated records and apply deletions/settings correctly',()=>{const before={boys:[{id:'1',name:'one'},{id:'2',name:'two'}],programs:[{id:'p'}],websiteSettings:{theme:'old'},refreshedAt:'old'};const after=applyStatePatch(before,{upserts:[{kind:'boys',record:{id:'1',name:'new'}},{kind:'websiteSettings',record:{id:'theme',value:'new'}}],deletes:[{kind:'boys',id:'2'}],refreshedAt:'now'});assert.equal(after.boys.length,1);assert.equal(after.boys[0].name,'new');assert.equal(before.boys.length,2);assert.deepEqual(after.programs,before.programs);assert.equal(after.websiteSettings.theme,'new');});
test.after(()=>db.close());

test('access changes take effect immediately and never grant unconfirmed users entry',async()=>{
 await seed();await mutate({action:'manage_record',kind:'access',id:'stranger@example.com',values:{name:'New',role:'mentor',active:true}});
 await user(stranger);assert.equal((await state()).viewer.role,'mentor');await user(admin);
 await mutate({action:'manage_record',kind:'access',id:'stranger@example.com',values:{name:'New',role:'mentor',active:false}});
 await user(stranger);await assert.rejects(state,/Access denied/);await user(admin);
 await assert.rejects(()=>mutate({action:'manage_record',kind:'access',id:'admin@example.com',values:{name:'Admin',role:'admin'}}),/at least one/);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=null where id=$1',[mentor]);await user(mentor);await assert.rejects(state,/Access denied/);
 await db.exec('reset role');await db.query('update auth.users set email_confirmed_at=now() where id=$1',[mentor]);
});
test('undo and invalid dates preserve unrelated history; content updates rollback as a unit',async()=>{
 await seed();const boyId=(await newBoy()).upserts[0].record.id,programId=(await newProgram()).upserts[0].record.id;
 await mutate({action:'set_attendance',boyId,programId,status:'Late'});await mutate({action:'set_invitation',boyId,programId,response:'Coming'});
 await mutate({action:'delete_attendance',boyId,programId});assert.equal((await state()).invitations.length,1);
 await mutate({action:'set_invitation',boyId,programId,invited:false});assert.equal((await state()).invitations.length,0);
 await assert.rejects(()=>mutate({action:'update_program',programId,programTypeId:'t',date:'2026-02-30'}));
 assert.equal((await state()).programs[0].date,'2026-09-27');
 await assert.rejects(()=>mutate({action:'update_website_content',values:{hero:'Changed',missing:'Invalid'}}));assert.equal((await state()).websiteContent.hero,'Hello');
 await assert.rejects(()=>mutate({action:'delete_managed_record',kind:'mentors',id:'m'}),/Reassign/);
});
test('private attachments require approved users and prevent unreachable files on profile deletion',async()=>{
 await seed();const boyId=(await newBoy()).upserts[0].record.id;
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['mentoring-private',boyId+'/file.pdf']);
 await assert.rejects(()=>mutate({action:'delete_boy',boyId}),/attachments/);assert.equal((await state()).boys.length,1);
 await user(stranger);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['mentoring-private',boyId+'/bad.pdf']),/row-level security/);
 await user(admin);await db.query('delete from storage.objects where name=$1',[boyId+'/file.pdf']);await mutate({action:'delete_boy',boyId});assert.equal((await state()).boys.length,0);
});
