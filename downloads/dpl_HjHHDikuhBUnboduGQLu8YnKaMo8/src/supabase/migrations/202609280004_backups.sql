begin;
create table public.mentoring_backups (
 id uuid primary key, request_key text unique not null, created_at timestamptz not null default now(),
 reason text not null, status text not null default 'pending' check(status in ('pending','complete','failed')),
 payload jsonb not null, files jsonb not null default '[]', error text
);
alter table public.mentoring_backups enable row level security;
revoke all on public.mentoring_backups from anon,authenticated;
grant select on public.mentoring_backups to authenticated;
grant all on public.mentoring_backups to service_role;
create policy mentoring_backups_admin on public.mentoring_backups for select to authenticated using(public.mentoring_role()='admin');
insert into storage.buckets(id,name,public,file_size_limit) values('mentoring-backups','mentoring-backups',false,4194304) on conflict(id) do nothing;

create function mentoring_private.export_data() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('format','mentoring-backup','version',1,
 'records',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'data',data) order by position,id),'[]') from public.mentoring_records),
 'access',(select coalesce(jsonb_agg(to_jsonb(a) order by email),'[]') from public.mentoring_access a));
$$;
create function public.mentoring_export() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb; begin
 if public.mentoring_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
 v=mentoring_private.export_data();return v||jsonb_build_object('fingerprint',md5(v::text),'exportedAt',now());
end; $$;
revoke all on function public.mentoring_export() from public,anon;
grant execute on function public.mentoring_export() to authenticated;

create function public.mentoring_backup_capture(p_id uuid,p_key text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb; f jsonb; b public.mentoring_backups%rowtype; begin
 perform pg_advisory_xact_lock(27092026);
 select * into b from public.mentoring_backups where request_key=p_key;
 if found then return to_jsonb(b); end if;
 v=mentoring_private.export_data();
 select coalesce(jsonb_agg(jsonb_build_object('path',name,'metadata',metadata) order by name),'[]') into f from storage.objects where bucket_id='mentoring-private';
 insert into public.mentoring_backups(id,request_key,reason,payload,files) values(p_id,p_key,p_reason,v||jsonb_build_object('fingerprint',md5(v::text),'exportedAt',now()),f) returning * into b;
 return to_jsonb(b);
end; $$;
revoke all on function public.mentoring_backup_capture(uuid,text,text) from public,anon,authenticated;
grant execute on function public.mentoring_backup_capture(uuid,text,text) to service_role;

create function public.mentoring_import(p_payload jsonb,p_expected text,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; a jsonb; v jsonb; old jsonb; k text; i text; actor text; baseline jsonb; previous mentoring_private.requests%rowtype; result jsonb; n integer=0;
begin
 if public.mentoring_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
 if exists(select 1 from mentoring_private.cutover where read_only) then raise exception 'Saving is temporarily paused'; end if;
 if p_request_id is null then raise exception 'Request ID required'; end if;
 perform pg_advisory_xact_lock(27092026);
 select * into previous from mentoring_private.requests where user_id=auth.uid() and request_id=p_request_id;
 if found then if previous.payload<>p_payload then raise exception 'Request ID already used'; end if; return previous.result; end if;
 baseline=mentoring_private.export_data();
 if p_expected is distinct from md5(baseline::text) then raise exception 'Records changed since preview. Preview the file again.'; end if;
 if jsonb_typeof(p_payload->'records') is distinct from 'array' or jsonb_typeof(p_payload->'access') is distinct from 'array' then raise exception 'Invalid import format'; end if;
 if jsonb_array_length(p_payload->'records')>5000 or jsonb_array_length(p_payload->'access')>500 then raise exception 'Import is too large'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'records') x group by x->>'kind',x->>'id' having count(*)>1) then raise exception 'Duplicate record IDs in import'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'access') x group by lower(x->>'email') having count(*)>1) then raise exception 'Duplicate account emails in import'; end if;
 select lower(email) into actor from auth.users where id=auth.uid();
 for r in select * from jsonb_array_elements(p_payload->'records') loop
  k=r->>'kind';i=r->>'id';
  if coalesce(k,'') not in ('boys','mentors','programTypes','programs','attendance','invitations','calendarEvents','websiteContent','websiteSettings') or coalesce(i,'')='' or length(i)>150 then raise exception 'Invalid record kind or ID'; end if;
  if jsonb_typeof(r->'data') is distinct from 'object' or (r->'data'->>'id') is distinct from i then raise exception 'Record ID mismatch'; end if;
  select data into old from public.mentoring_records where kind=k and id=i;
  v=(case k
   when 'boys' then '{"contact":"","college":"","hostel":"","floor":"","branch":"","section":"","status":"Active","comment":"","createdAt":"","createdBy":""}'::jsonb
   when 'mentors' then '{"initials":"","tone":"green","email":""}'::jsonb
   when 'programs' then '{"programType":"","venue":"","speaker":"","createdAt":""}'::jsonb
   when 'attendance' then '{"reason":"","updatedAt":"","updatedBy":""}'::jsonb
   when 'invitations' then '{"updatedAt":"","updatedBy":""}'::jsonb
   when 'calendarEvents' then '{"endDate":"","type":"","availability":"","semester":"","scope":"","note":"","source":""}'::jsonb
   else '{}'::jsonb end)||coalesce(old,'{}')||(r->'data');
  if exists(select 1 from jsonb_each(v) f where f.key in ('id','name','contact','college','hostel','floor','branch','section','status','comment','createdAt','createdBy','initials','tone','email','programType','venue','speaker','reason','updatedAt','updatedBy','endDate','type','availability','semester','scope','note','source','title','startDate','date','mentorId','boyId','programId','programTypeId','response','value') and jsonb_typeof(f.value)<>'string') then raise exception 'Record fields must contain text';end if;
  if k='mentors' and v->>'initials'='' then v=v||jsonb_build_object('initials',upper(left(v->>'name',2)));end if;
  if k in ('boys','mentors','programTypes','programs') then perform mentoring_private.required(v->>'name','Name'); end if;
  if k='boys' then
   if coalesce(v->>'status','') not in ('Active','Passive','Dropped') then raise exception 'Invalid boy status'; end if;
   if (coalesce(v->>'floor','')<>coalesce(old->>'floor','') or coalesce(v->>'hostel','')<>coalesce(old->>'hostel','')) and coalesce(v->>'floor','')<>'' then
    if v->>'floor' !~ '^B[0-9]$' or coalesce(v->>'hostel','') !~ '^\d+$' then raise exception 'Invalid floor or room'; end if;
    if (v->>'hostel')::numeric not between 1 and 61 then raise exception 'Room must be 1 to 61'; end if;
   end if;
  end if;
  if k='programs' then perform mentoring_private.valid_date(v->>'date'); end if;
  if k='calendarEvents' then
   perform mentoring_private.required(v->>'title','Event title');perform mentoring_private.valid_date(v->>'startDate');
   if coalesce(v->>'endDate','')<>'' then perform mentoring_private.valid_date(v->>'endDate');if v->>'endDate'<v->>'startDate' then raise exception 'Event ends before it starts';end if;end if;
  end if;
  if k='attendance' then
   if coalesce(v->>'status','') not in ('Present','Absent','Late') then raise exception 'Invalid attendance status'; end if;
   if v->>'status'='Absent' then perform mentoring_private.required(v->>'reason','Absence reason');end if;
  end if;
  if k='invitations' then perform mentoring_private.required(v->>'response','Invitation response');end if;
  if k in ('websiteContent','websiteSettings') and jsonb_typeof(v->'value') is distinct from 'string' then raise exception 'Setting/content values must be text';end if;
  insert into public.mentoring_records(kind,id,data) values(k,i,v) on conflict(kind,id) do update set data=excluded.data;
  n=n+1;
 end loop;
 for a in select * from jsonb_array_elements(p_payload->'access') loop
  i=lower(trim(a->>'email'));
  if coalesce(i,'') !~ '^[^ @]+@[^ @]+\.[^ @]+$' or coalesce(a->>'role','') not in ('admin','mentor') or jsonb_typeof(a->'active') is distinct from 'boolean' then raise exception 'Invalid account permission';end if;
  if i=actor and (a->>'role'<>'admin' or not (a->>'active')::boolean) then raise exception 'Import cannot remove your own administrator access';end if;
  insert into public.mentoring_access(email,name,role,active,source) values(i,coalesce(a->>'name',''),a->>'role',(a->>'active')::boolean,coalesce(a->'source','{}'))
  on conflict(email) do update set name=excluded.name,role=excluded.role,active=excluded.active,source=excluded.source;
 end loop;
 -- Check the resulting dataset so rows can refer to parents later in the same file.
 if exists(select 1 from public.mentoring_records r where r.kind='boys' and not exists(select 1 from public.mentoring_records p where p.kind='mentors' and p.id=r.data->>'mentorId')) then raise exception 'A boy references an unknown mentor';end if;
 if exists(select 1 from public.mentoring_records r where r.kind='programs' and not exists(select 1 from public.mentoring_records p where p.kind='programTypes' and p.id=r.data->>'programTypeId')) then raise exception 'A program references an unknown program type';end if;
 if exists(select 1 from public.mentoring_records r where r.kind in ('attendance','invitations') and
  (not exists(select 1 from public.mentoring_records p where p.kind='boys' and p.id=r.data->>'boyId') or not exists(select 1 from public.mentoring_records p where p.kind='programs' and p.id=r.data->>'programId') or not exists(select 1 from public.mentoring_records p where p.kind='mentors' and p.id=r.data->>'mentorId'))) then raise exception 'Attendance or invitation references an unknown record';end if;
 if exists(select 1 from public.mentoring_records a join public.mentoring_records p on p.kind='programs' and p.id=a.data->>'programId' where a.kind='attendance' and a.data->>'status'='Present' group by a.data->>'boyId',p.data->>'programTypeId' having count(*)>1) then raise exception 'Duplicate Present credit for a program type';end if;
 if not exists(select 1 from public.mentoring_access where active and role='admin') then raise exception 'Keep an active administrator';end if;
 update public.mentoring_records p set data=p.data||jsonb_build_object('programType',t.data->>'name') from public.mentoring_records t where p.kind='programs' and t.kind='programTypes' and t.id=p.data->>'programTypeId';
 insert into mentoring_private.source_snapshots(source_id,payload) values('before-import:'||p_request_id::text,baseline);
 result=jsonb_build_object('records',n,'access',jsonb_array_length(p_payload->'access'));
 insert into mentoring_private.requests(user_id,request_id,payload,result) values(auth.uid(),p_request_id,p_payload,result);
 return result;
end; $$;
revoke all on function public.mentoring_import(jsonb,text,uuid) from public,anon;
grant execute on function public.mentoring_import(jsonb,text,uuid) to authenticated;
revoke all on function mentoring_private.export_data() from public,anon,authenticated;
create function public.mentoring_import_preview(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare f text; r jsonb; updates integer; begin
 if public.mentoring_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501';end if;
 f=md5(mentoring_private.export_data()::text);
 begin
  r=public.mentoring_import(p_payload,f,gen_random_uuid());
  raise exception using errcode='PZ001',message='Preview rollback';
 exception when sqlstate 'PZ001' then null;
 end;
 select count(*) into updates from jsonb_array_elements(p_payload->'records') x join public.mentoring_records p on p.kind=x->>'kind' and p.id=x->>'id';
 return r||jsonb_build_object('fingerprint',f,'updates',updates,'additions',jsonb_array_length(p_payload->'records')-updates);
end; $$;
revoke all on function public.mentoring_import_preview(jsonb) from public,anon;
grant execute on function public.mentoring_import_preview(jsonb) to authenticated;
commit;
