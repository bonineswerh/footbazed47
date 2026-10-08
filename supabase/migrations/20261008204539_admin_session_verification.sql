-- Narrow service-only reader. Never expose Auth tables or factor secrets through PostgREST.
create or replace function public.admin_auth_session_state(p_actor uuid, p_session uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'active', exists (
      select 1 from auth.sessions s join public.users u on u.id=s.user_id
      where s.id=p_session and s.user_id=p_actor and u.is_admin is true
        and (s.not_after is null or s.not_after>now())
    ),
    'aal', (
      select s.aal::text from auth.sessions s join public.users u on u.id=s.user_id
      where s.id=p_session and s.user_id=p_actor and u.is_admin is true
        and (s.not_after is null or s.not_after>now())
    ),
    'factor_verified', exists (
      select 1 from auth.sessions s join public.users u on u.id=s.user_id
      join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
      where s.id=p_session and s.user_id=p_actor and u.is_admin is true
        and (s.not_after is null or s.not_after>now())
        and f.factor_type='totp' and f.status='verified'
    )
  );
$$;
revoke all on function public.admin_auth_session_state(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_auth_session_state(uuid,uuid) to service_role;
comment on function public.admin_auth_session_state(uuid,uuid) is
  'Service-only live administrator session assurance. No credentials or factor identifiers returned.';
