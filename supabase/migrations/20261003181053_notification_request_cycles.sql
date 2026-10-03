-- A new pending friendship is a new request, including after removal.
-- request_friendship already locks the pair and reuses an existing pending
-- row; its AFTER INSERT trigger runs only for an actual new request. A lifetime
-- notification uniqueness rule silently discarded legitimate later requests.
drop index public.notifications_friend_request_once_idx;
