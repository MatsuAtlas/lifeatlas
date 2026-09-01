create table if not exists public.comparison_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  origin_city text not null,
  destination_city text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comparison_history
  add column if not exists updated_at timestamptz not null default now();

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
grant update (title, updated_at) on table public.comparison_history to authenticated;

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

drop policy if exists "Users can rename their own comparison history" on public.comparison_history;
create policy "Users can rename their own comparison history"
  on public.comparison_history for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age smallint not null,
  household_type text not null,
  children smallint not null default 0,
  base_currency text not null,
  current_city text not null,
  priorities jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_age check (age between 18 and 100),
  constraint user_profiles_household check (household_type in ('single', 'couple')),
  constraint user_profiles_children check (children between 0 and 10),
  constraint user_profiles_currency_format check (base_currency ~ '^[A-Z]{3}$'),
  constraint user_profiles_city_length check (char_length(current_city) between 1 and 64),
  constraint user_profiles_priorities_object check (jsonb_typeof(priorities) = 'object')
);

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;

revoke all on table public.user_profiles from anon;
revoke all on table public.user_profiles from authenticated;
grant select on table public.user_profiles to authenticated;
grant insert (user_id, age, household_type, children, base_currency, current_city, priorities, updated_at) on table public.user_profiles to authenticated;
grant update (age, household_type, children, base_currency, current_city, priorities, updated_at) on table public.user_profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile" on public.user_profiles for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can create their own profile" on public.user_profiles;
create policy "Users can create their own profile" on public.user_profiles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile" on public.user_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_hash text not null,
  model text not null,
  prompt_version text not null,
  language text not null,
  question text,
  status text not null default 'pending',
  recommendation jsonb,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, context_hash),
  constraint ai_recommendations_context_hash check (context_hash ~ '^[0-9a-f]{64}$'),
  constraint ai_recommendations_language check (language in ('ja', 'en')),
  constraint ai_recommendations_status check (status in ('pending', 'complete', 'error')),
  constraint ai_recommendations_question_length check (question is null or char_length(question) between 1 and 400),
  constraint ai_recommendations_recommendation_object check (recommendation is null or jsonb_typeof(recommendation) = 'object'),
  constraint ai_recommendations_token_counts check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  )
);

create index if not exists ai_recommendations_user_created_idx
  on public.ai_recommendations (user_id, created_at desc);

alter table public.ai_recommendations enable row level security;
alter table public.ai_recommendations force row level security;

revoke all on table public.ai_recommendations from anon;
revoke all on table public.ai_recommendations from authenticated;
grant select on table public.ai_recommendations to authenticated;
grant insert (user_id, context_hash, model, prompt_version, language, question, status)
  on table public.ai_recommendations to authenticated;
grant update (status, recommendation, input_tokens, output_tokens, total_tokens, error_code, updated_at)
  on table public.ai_recommendations to authenticated;

drop policy if exists "Users can read their own AI recommendations" on public.ai_recommendations;
create policy "Users can read their own AI recommendations"
  on public.ai_recommendations for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own AI recommendations" on public.ai_recommendations;
create policy "Users can create their own AI recommendations"
  on public.ai_recommendations for insert to authenticated
  with check (auth.uid() = user_id and status = 'pending' and recommendation is null);

drop policy if exists "Users can update their own AI recommendations" on public.ai_recommendations;
create policy "Users can update their own AI recommendations"
  on public.ai_recommendations for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text not null,
  interval text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  last_event_created bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customer_id_format check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  constraint billing_subscription_id_format check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  constraint billing_price_id_format check (price_id ~ '^price_[A-Za-z0-9]+$'),
  constraint billing_status check (status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')),
  constraint billing_interval check (interval is null or interval in ('month', 'year')),
  constraint billing_event_created check (last_event_created >= 0)
);

create index if not exists billing_subscriptions_customer_idx
  on public.billing_subscriptions (stripe_customer_id);

alter table public.billing_subscriptions enable row level security;
alter table public.billing_subscriptions force row level security;

revoke all on table public.billing_subscriptions from anon;
revoke all on table public.billing_subscriptions from authenticated;
grant select on table public.billing_subscriptions to authenticated;

drop policy if exists "Users can read their own billing subscription" on public.billing_subscriptions;
create policy "Users can read their own billing subscription"
  on public.billing_subscriptions for select to authenticated
  using (auth.uid() = user_id);

create table if not exists public.public_shares (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  language text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint public_shares_id_format check (id ~ '^[A-Za-z0-9_-]{16}$'),
  constraint public_shares_title_length check (char_length(title) between 1 and 120),
  constraint public_shares_language check (language in ('ja', 'en')),
  constraint public_shares_snapshot_object check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists public_shares_user_created_idx
  on public.public_shares (user_id, created_at desc);

alter table public.public_shares enable row level security;
alter table public.public_shares force row level security;

revoke all on table public.public_shares from anon, authenticated;

create table if not exists public.analytics_events (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid,
  event_name text not null,
  pathname text,
  properties jsonb not null default '{}'::jsonb,
  source_event_id text unique,
  created_at timestamptz not null default now(),
  constraint analytics_events_name check (event_name in ('landing_to_analyzer', 'analyzer_started', 'first_scenario_created', 'second_scenario_created', 'analysis_completed', 'ai_recommendation_viewed', 'pricing_viewed', 'upgrade_clicked', 'subscription_completed', 'subscription_canceled', 'signup_completed', 'saved_comparison', 'share_clicked', 'share_viewed', 'analysis_downloaded')),
  constraint analytics_events_path_length check (pathname is null or char_length(pathname) between 1 and 200),
  constraint analytics_events_source_length check (source_event_id is null or char_length(source_event_id) between 1 and 120),
  constraint analytics_events_properties_object check (jsonb_typeof(properties) = 'object')
);

alter table public.analytics_events drop constraint if exists analytics_events_name;
alter table public.analytics_events add constraint analytics_events_name check (
  event_name in ('landing_to_analyzer', 'analyzer_started', 'first_scenario_created', 'second_scenario_created', 'analysis_completed', 'ai_recommendation_viewed', 'pricing_viewed', 'upgrade_clicked', 'subscription_completed', 'subscription_canceled', 'signup_completed', 'saved_comparison', 'share_clicked', 'share_viewed', 'analysis_downloaded')
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc) where user_id is not null;

alter table public.analytics_events enable row level security;
alter table public.analytics_events force row level security;

revoke all on table public.analytics_events from anon, authenticated;

-- Supabase may install this internal SECURITY DEFINER helper in the public schema.
-- Keep it available to its owner while preventing API roles from invoking it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
