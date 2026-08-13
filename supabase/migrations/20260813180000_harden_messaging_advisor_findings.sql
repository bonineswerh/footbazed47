-- Resolve actionable advisor findings without weakening Realtime or Storage RLS.

create index if not exists direct_messages_rating_id_idx
  on public.direct_messages (rating_id)
  where rating_id is not null;

drop policy if exists "No direct rating activity access" on public.rating_activity_days;
create policy "No direct rating activity access"
on public.rating_activity_days
for all
to public
using (false)
with check (false);

-- Match chat is read through get_match_chat_messages and written only by RPC.
revoke select on table public.chat_messages from anon, authenticated;

notify pgrst, 'reload schema';
