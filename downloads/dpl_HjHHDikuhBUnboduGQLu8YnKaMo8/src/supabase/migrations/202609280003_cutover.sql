begin;
create table mentoring_private.cutover (id boolean primary key default true check(id),read_only boolean not null default false);
insert into mentoring_private.cutover(id,read_only) values(true,false);
alter function public.mentoring_mutate(jsonb,uuid) rename to mentoring_mutate_impl;
revoke all on function public.mentoring_mutate_impl(jsonb,uuid) from public,anon,authenticated;
create function public.mentoring_mutate(p_body jsonb,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from mentoring_private.cutover where read_only) then raise exception 'The database switch is finishing. Please wait a few minutes before saving.'; end if;
 return public.mentoring_mutate_impl(p_body,p_request_id);
end; $$;
revoke all on function public.mentoring_mutate(jsonb,uuid) from public,anon;
grant execute on function public.mentoring_mutate(jsonb,uuid) to authenticated;
commit;
