-- Retire messaging without deleting conversations, messages, attachments or FKs.
-- Previous grants/policies remain reproducible from the append-only history.
-- Existing media signed URLs expire naturally (client issued them for one hour).
begin;

revoke all on table public.chat_messages, public.direct_conversations, public.direct_messages from public, anon, authenticated;
revoke all on function public.get_match_chat_messages(bigint,integer) from public, anon, authenticated;
revoke all on function public.send_match_chat_message(bigint,text) from public, anon, authenticated;
revoke all on function public.edit_match_chat_message(integer,text) from public, anon, authenticated;
revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon, authenticated;
revoke all on function public.get_direct_messages(bigint,integer,bigint) from public, anon, authenticated;
revoke all on function public.send_direct_message(bigint,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.edit_direct_message(bigint,text) from public, anon, authenticated;

-- RLS defense in depth: even an accidental future table grant cannot reopen it.
create policy "Retired messaging is inaccessible" on public.chat_messages as restrictive for all to anon, authenticated using (false) with check (false);
create policy "Retired messaging is inaccessible" on public.direct_conversations as restrictive for all to anon, authenticated using (false) with check (false);
create policy "Retired messaging is inaccessible" on public.direct_messages as restrictive for all to anon, authenticated using (false) with check (false);

drop policy if exists "Conversation members read chat media" on storage.objects;
drop policy if exists "Conversation members upload chat media" on storage.objects;
drop policy if exists "Authors delete own chat media" on storage.objects;
create policy "Retired chat media is inaccessible" on storage.objects as restrictive for all to anon, authenticated using (bucket_id <> 'chat-media') with check (bucket_id <> 'chat-media');

do $$ begin
  if exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='direct_messages') then
    alter publication supabase_realtime drop table public.direct_messages;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
