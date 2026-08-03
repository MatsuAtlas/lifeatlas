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

create index if not exists comparison_history_user_created_idx
  on public.comparison_history (user_id, created_at desc);

alter table public.comparison_history enable row level security;

drop policy if exists "Users can read their own comparison history" on public.comparison_history;
create policy "Users can read their own comparison history"
  on public.comparison_history for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own comparison history" on public.comparison_history;
create policy "Users can insert their own comparison history"
  on public.comparison_history for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own comparison history" on public.comparison_history;
create policy "Users can delete their own comparison history"
  on public.comparison_history for delete
  using (auth.uid() = user_id);
