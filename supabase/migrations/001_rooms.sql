-- Apply once to a fresh Supabase project. All app access uses the authenticated role.
create extension if not exists pgcrypto with schema extensions;
create table public.rooms (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), title text not null check(length(title) between 1 and 100), created_at timestamptz not null default now());
create table public.room_members (room_id uuid not null references public.rooms on delete cascade, user_id uuid not null references auth.users, primary key(room_id,user_id));
create table public.room_messages (id bigint generated always as identity primary key, room_id uuid not null references public.rooms on delete cascade, user_id uuid not null references auth.users, body text not null check(length(trim(body)) between 1 and 6000), created_at timestamptz not null default now());
create table public.room_invites (token_hash text primary key, room_id uuid not null references public.rooms on delete cascade, expires_at timestamptz not null, remaining_uses int not null check(remaining_uses>=0));
create index on public.room_members(user_id);
create index on public.room_messages(room_id,id);
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_messages enable row level security;
alter table public.room_invites enable row level security;

create function public.is_room_member(room uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.room_members where room_id=room and user_id=(select auth.uid()));
$$;
create policy rooms_read on public.rooms for select to authenticated using(public.is_room_member(id));
create policy members_read on public.room_members for select to authenticated using(public.is_room_member(room_id));
create policy messages_read on public.room_messages for select to authenticated using(public.is_room_member(room_id));
create policy messages_write on public.room_messages for insert to authenticated with check(user_id=(select auth.uid()) and public.is_room_member(room_id));
revoke all on public.rooms,public.room_members,public.room_messages,public.room_invites from anon,authenticated;
grant select on public.rooms,public.room_members,public.room_messages to authenticated;
grant insert on public.room_messages to authenticated;
grant usage on sequence public.room_messages_id_seq to authenticated;

create function public.create_room(room_title text) returns uuid language plpgsql security definer set search_path='' as $$
declare room uuid; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 insert into public.rooms(owner_id,title) values(uid,trim(room_title)) returning id into room;
 insert into public.room_members values(room,uid);
 return room;
end; $$;

create function public.create_room_invite(room uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not exists(select 1 from public.rooms where id=room and owner_id=auth.uid()) then raise exception 'Owner access required'; end if;
 token := encode(extensions.gen_random_bytes(32),'hex');
 insert into public.room_invites values(encode(extensions.digest(token,'sha256'),'hex'),room,now()+interval '24 hours',10);
 return token;
end; $$;

create function public.join_room(invite_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.room_invites; uid uuid := auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if length(invite_token)<>64 then raise exception 'Invitation unavailable'; end if;
 select * into invitation from public.room_invites where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') for update;
 if not found or invitation.expires_at<=now() or invitation.remaining_uses<=0 then raise exception 'Invitation unavailable'; end if;
 if not exists(select 1 from public.room_members where room_id=invitation.room_id and user_id=uid) then
  insert into public.room_members values(invitation.room_id,uid);
  update public.room_invites set remaining_uses=remaining_uses-1 where token_hash=invitation.token_hash;
 end if;
 return invitation.room_id;
end; $$;
revoke all on function public.is_room_member(uuid),public.create_room(text),public.create_room_invite(uuid),public.join_room(text) from public,anon;
grant execute on function public.is_room_member(uuid),public.create_room(text),public.create_room_invite(uuid),public.join_room(text) to authenticated;
-- Realtime uses table RLS on Postgres Changes subscriptions.
alter publication supabase_realtime add table public.room_messages;
