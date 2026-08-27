create table if not exists public.comparison_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  origin_city text not null,
  destination_city text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'comparison_history_title_length' and conrelid = 'public.comparison_history'::regclass) then
    alter table public.comparison_history add constraint comparison_history_title_length check (char_length(title) between 1 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comparison_history_origin_city_length' and conrelid = 'public.comparison_history'::regclass) then
    alter table public.comparison_history add constraint comparison_history_origin_city_length check (char_length(origin_city) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comparison_history_destination_city_length' and conrelid = 'public.comparison_history'::regclass) then
    alter table public.comparison_history add constraint comparison_history_destination_city_length check (char_length(destination_city) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comparison_history_input_object' and conrelid = 'public.comparison_history'::regclass) then
    alter table public.comparison_history add constraint comparison_history_input_object check (jsonb_typeof(input) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'comparison_history_result_object' and conrelid = 'public.comparison_history'::regclass) then
    alter table public.comparison_history add constraint comparison_history_result_object check (jsonb_typeof(result) = 'object');
  end if;
end
$$;

create index if not exists comparison_history_user_created_idx
  on public.comparison_history (user_id, created_at desc);

alter table public.comparison_history enable row level security;
alter table public.comparison_history force row level security;

revoke all on table public.comparison_history from anon;
revoke all on table public.comparison_history from authenticated;
grant select, delete on table public.comparison_history to authenticated;
grant insert (user_id, title, origin_city, destination_city, input, result)
  on table public.comparison_history to authenticated;

drop policy if exists "Users can read their own comparison history" on public.comparison_history;
create policy "Users can read their own comparison history"
  on public.comparison_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own comparison history" on public.comparison_history;
create policy "Users can insert their own comparison history"
  on public.comparison_history for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comparison history" on public.comparison_history;
create policy "Users can delete their own comparison history"
  on public.comparison_history for delete to authenticated
  using (auth.uid() = user_id);

-- Supabase may install this internal SECURITY DEFINER helper in the public schema.
-- Keep it available to its owner while preventing API roles from invoking it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
