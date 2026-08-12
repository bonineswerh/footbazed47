create or replace function public.validate_player_rating_roster()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.matches m
    join public.players p on p.id = new.player_id
    where m.id = new.match_id
      and (
        (p.club_id is not null and p.club_id = any (array[m.home_club_id, m.away_club_id]))
        or lower(btrim(p.team)) = any (
          array[lower(btrim(m.home_team_name)), lower(btrim(m.away_team_name))]
        )
      )
  ) then
    raise exception using errcode = '22023', message = 'player_not_in_match';
  end if;
  return new;
end
$function$;

drop trigger if exists validate_player_rating_roster_trigger on public.player_ratings;
create trigger validate_player_rating_roster_trigger
before insert or update of match_id, player_id on public.player_ratings
for each row execute function public.validate_player_rating_roster();

create or replace function public.request_friendship(p_friend_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_friend_id is null or p_friend_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;
  if not exists (select 1 from public.users u where u.id = p_friend_id) then
    raise exception using errcode = 'P0002', message = 'user_not_found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, p_friend_id::text) || ':' ||
      greatest(current_user_id::text, p_friend_id::text),
      0
    )
  );

  if exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = current_user_id and f.friend_id = p_friend_id)
        or (f.user_id = p_friend_id and f.friend_id = current_user_id))
  ) then
    return jsonb_build_object('status', 'accepted', 'changed', false);
  end if;

  if exists (
    select 1 from public.friendships f
    where f.user_id = current_user_id and f.friend_id = p_friend_id and f.status = 'pending'
  ) then
    return jsonb_build_object('status', 'pending', 'changed', false);
  end if;

  if exists (
    select 1 from public.friendships f
    where f.user_id = p_friend_id and f.friend_id = current_user_id and f.status = 'pending'
    for update
  ) then
    update public.friendships
    set status = 'accepted'
    where user_id = p_friend_id and friend_id = current_user_id and status = 'pending';

    insert into public.friendships (user_id, friend_id, status)
    values (current_user_id, p_friend_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';

    update public.notifications
    set read = true
    where user_id = current_user_id and from_user_id = p_friend_id
      and type = 'friend_request' and read = false;

    return jsonb_build_object('status', 'accepted', 'changed', true);
  end if;

  delete from public.friendships
  where ((user_id = current_user_id and friend_id = p_friend_id)
      or (user_id = p_friend_id and friend_id = current_user_id))
    and status = 'rejected';

  insert into public.friendships (user_id, friend_id, status)
  values (current_user_id, p_friend_id, 'pending')
  on conflict (user_id, friend_id) do update set status = 'pending';

  return jsonb_build_object('status', 'pending', 'changed', true);
end
$function$;

create or replace function public.respond_friendship(p_requester_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  normalized_action text := lower(btrim(coalesce(p_action, '')));
  request_id integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_requester_id is null or p_requester_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;
  if normalized_action not in ('accept', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_friendship_action';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, p_requester_id::text) || ':' ||
      greatest(current_user_id::text, p_requester_id::text),
      0
    )
  );

  select f.id into request_id
  from public.friendships f
  where f.user_id = p_requester_id and f.friend_id = current_user_id and f.status = 'pending'
  for update;

  if request_id is null then
    if normalized_action = 'accept' and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id = current_user_id and f.friend_id = p_requester_id)
          or (f.user_id = p_requester_id and f.friend_id = current_user_id))
    ) then
      return jsonb_build_object('status', 'accepted', 'changed', false);
    end if;
    raise exception using errcode = 'P0002', message = 'friendship_request_not_found';
  end if;

  if normalized_action = 'accept' then
    update public.friendships set status = 'accepted' where id = request_id;
    insert into public.friendships (user_id, friend_id, status)
    values (current_user_id, p_requester_id, 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  else
    delete from public.friendships where id = request_id;
  end if;

  update public.notifications
  set read = true
  where user_id = current_user_id and from_user_id = p_requester_id
    and type = 'friend_request' and read = false;

  return jsonb_build_object(
    'status', case when normalized_action = 'accept' then 'accepted' else 'rejected' end,
    'changed', true
  );
end
$function$;

create or replace function public.remove_friendship(p_other_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'auth_required';
  end if;
  if p_other_id is null or p_other_id = current_user_id then
    raise exception using errcode = '22023', message = 'invalid_friend';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(current_user_id::text, p_other_id::text) || ':' ||
      greatest(current_user_id::text, p_other_id::text),
      0
    )
  );

  delete from public.friendships
  where (user_id = current_user_id and friend_id = p_other_id)
     or (user_id = p_other_id and friend_id = current_user_id);
  get diagnostics deleted_count = row_count;

  update public.notifications
  set read = true
  where type = 'friend_request' and read = false
    and ((user_id = current_user_id and from_user_id = p_other_id)
      or (user_id = p_other_id and from_user_id = current_user_id));

  return jsonb_build_object('status', 'removed', 'changed', deleted_count > 0);
end
$function$;

revoke all on function public.validate_player_rating_roster() from public, anon, authenticated;
revoke all on function public.request_friendship(uuid) from public, anon;
revoke all on function public.respond_friendship(uuid, text) from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.request_friendship(uuid) to authenticated;
grant execute on function public.respond_friendship(uuid, text) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;

grant select on table public.friendships to authenticated;

notify pgrst, 'reload schema';
