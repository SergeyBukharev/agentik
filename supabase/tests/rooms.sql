-- Execute with psql as database owner on a disposable local Supabase DB.
-- Transaction rolls back fixture users and every room/message.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_room('Test room') as room_id \gset
select public.create_room_invite(:'room_id') as invite_token \gset
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select set_config('test.room',:'room_id',true);
select set_config('test.token',:'invite_token',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.rooms) then raise exception 'Outsider can read rooms'; end if;
 if exists(select 1 from public.room_messages) then raise exception 'Outsider can read messages'; end if;
 begin
  insert into public.room_messages(room_id,user_id,body) values(current_setting('test.room')::uuid,auth.uid(),'unauthorized');
  raise exception 'Outsider can write';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.room_members values(current_setting('test.room')::uuid,auth.uid());
  raise exception 'Self enrollment allowed';
 exception when insufficient_privilege then null; end;
 begin perform public.create_room_invite(current_setting('test.room')::uuid); raise exception 'Outsider can invite'; exception when raise_exception then if sqlerrm<>'Owner access required' then raise; end if; end;
 perform public.join_room(current_setting('test.token'));
 if not exists(select 1 from public.rooms where id=current_setting('test.room')::uuid) then raise exception 'Valid invite failed'; end if;
 insert into public.room_messages(room_id,user_id,body) values(current_setting('test.room')::uuid,auth.uid(),'joined');
end $$;
reset role;
update public.room_invites set expires_at=now()-interval '1 second';
set local role authenticated;
do $$ begin
 begin perform public.join_room(current_setting('test.token')); raise exception 'Expired invite accepted'; exception when raise_exception then if sqlerrm<>'Invitation unavailable' then raise; end if; end;
end $$;
rollback;
\echo 'Room access checks passed'
