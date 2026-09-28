begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mentoring-private','mentoring-private',false,4194304,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create policy mentoring_files_read on storage.objects for select to authenticated
using(bucket_id='mentoring-private' and public.mentoring_role() is not null);
create policy mentoring_files_insert on storage.objects for insert to authenticated
with check(bucket_id='mentoring-private' and public.mentoring_role() is not null and
 exists(select 1 from public.mentoring_records where kind='boys' and id=(storage.foldername(name))[1]));
create policy mentoring_files_delete on storage.objects for delete to authenticated
using(bucket_id='mentoring-private' and public.mentoring_role() is not null);
-- Keep attachments reachable; dropping a boy retains both registration and files.
create function mentoring_private.protect_attached_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.kind='boys' and exists(select 1 from storage.objects where bucket_id='mentoring-private' and (storage.foldername(name))[1]=old.id) then
  raise exception 'Remove this boy''s attachments before deleting the registration, or mark him Dropped to keep his records';
 end if;
 return old;
end; $$;
revoke all on function mentoring_private.protect_attached_profile() from public,anon,authenticated;
create trigger mentoring_profile_files before delete on public.mentoring_records for each row execute function mentoring_private.protect_attached_profile();
commit;
