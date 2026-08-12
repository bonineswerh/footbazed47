-- Friendship writes must pass through the transaction-safe RPCs.
drop policy if exists "Create own friend request" on public.friendships;
drop policy if exists "Recipient responds to friend request" on public.friendships;
drop policy if exists "Remove own friendship" on public.friendships;

revoke insert, update, delete on table public.friendships from authenticated;
grant select on table public.friendships to authenticated;

-- Match chat is append-only for clients. RLS already has no update/delete policy,
-- but explicit grants keep the Data API contract least-privileged as well.
revoke update, delete on table public.chat_messages from authenticated;
grant select, insert on table public.chat_messages to authenticated;

comment on table public.friendships is
  'Client-readable relationship state. Writes are allowed only through request_friendship, respond_friendship and remove_friendship RPCs.';
