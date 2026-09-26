-- Editing uses the same active-friendship boundary as reads and sends.
-- Additive replacement only: existing signatures and payloads remain compatible.
create or replace function public.edit_direct_message(p_message_id bigint, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  clean_body text := nullif(btrim(coalesce(p_body, '')), '');
  conversation public.direct_conversations;
  saved public.direct_messages;
begin
  if current_user_id is null then raise exception using errcode = '42501', message = 'auth_required'; end if;
  if clean_body is null or char_length(clean_body) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_message';
  end if;

  select c.* into conversation
  from public.direct_messages dm
  join public.direct_conversations c on c.id = dm.conversation_id
  where dm.id = p_message_id and dm.sender_id = current_user_id
    and current_user_id in (c.user_a, c.user_b);
  if conversation.id is null then
    raise exception using errcode = 'P0002', message = 'message_not_found';
  end if;

  -- Share the friendship mutation lock so removal and editing cannot interleave.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(conversation.user_a::text, conversation.user_b::text) || ':' ||
    greatest(conversation.user_a::text, conversation.user_b::text), 0
  ));
  if not public.are_friends(conversation.user_a, conversation.user_b) then
    raise exception using errcode = '42501', message = 'friendship_required';
  end if;

  update public.direct_messages set body = clean_body, updated_at = now(), edited_at = now()
  where id = p_message_id and sender_id = current_user_id returning * into saved;
  if saved.id is null then raise exception using errcode = 'P0002', message = 'message_not_found'; end if;
  return jsonb_build_object('id', saved.id, 'body', saved.body, 'updated_at', saved.updated_at, 'edited_at', saved.edited_at);
end
$function$;

revoke all on function public.edit_direct_message(bigint, text) from public, anon;
grant execute on function public.edit_direct_message(bigint, text) to authenticated;

notify pgrst, 'reload schema';
