create index if not exists notifications_rating_id_idx
  on public.notifications (rating_id)
  where rating_id is not null;
