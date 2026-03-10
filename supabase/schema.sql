-- Adaptive state sessions table
-- Stores anonymized behavioral sessions for interaction-state training data collection

create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  session_id text not null,
  product_id text default 'sony-wh1000xm5',

  -- Layer 1 Signals
  rage_clicks int default 0,
  mouse_jitter float default 0,
  exit_intent int default 0,
  dwell_events int default 0,
  scroll_thrash float default 0,
  dead_clicks int default 0,
  product_views int default 0,
  spec_dwell int default 0,
  cart_add_remove float default 0,
  price_hover int default 0,
  direct_checkout boolean default false,
  total_visits int default 1,
  cart_abandons int default 0,
  hour int,
  mobile boolean default false,

  -- Outcome
  outcome text, -- 'purchased' | 'abandoned' | 'saved' | 'left'
  time_on_page_sec int,

  -- Engine Classification
  classified_state text,
  classified_action text,
  confidence float,

  -- Metadata
  user_agent text,
  screen_width int,

  -- Extended Metrics (v2)
  click_targets jsonb default '{}',
  hover_targets jsonb default '{}',
  funnel_stage text default 'product_view',
  dropoff_stage text,
  scroll_depth int default 0,
  scroll_speed text,
  time_on_price float default 0,
  form_errors int default 0,
  user_type text,
  traffic_source text,
  outcome_detail jsonb default '{}'
);

-- Index for dashboard queries
create index if not exists idx_sessions_created_at on sessions(created_at desc);
create index if not exists idx_sessions_classified_state on sessions(classified_state);
create index if not exists idx_sessions_funnel_stage on sessions(funnel_stage);
create index if not exists idx_sessions_traffic_source on sessions(traffic_source);

-- RLS policies
alter table sessions enable row level security;

create policy "Allow anonymous inserts"
  on sessions for insert
  with check (true);

create policy "Allow anonymous reads"
  on sessions for select
  using (true);
