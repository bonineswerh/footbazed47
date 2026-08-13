-- Apply only after the supporter-aware frontend is live. This removes the
-- legacy RPC signature and forces match-chat writes through validated RPCs.

drop function if exists public.save_match_rating(bigint, smallint, text, boolean, jsonb);

revoke insert, update, delete on table public.chat_messages from authenticated;

notify pgrst, 'reload schema';
