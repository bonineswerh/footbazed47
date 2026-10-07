-- Cover the administrator foreign key for account cleanup and registry maintenance.
create index community_experts_assigned_by_idx on private.community_experts(assigned_by);
