-- CP807 Family Mode foundation
-- Apply once to the intended Dinliminate PostgreSQL database.

create extension if not exists pgcrypto;

create table if not exists family_rooms (
  family_id uuid primary key default gen_random_uuid(),
  join_code varchar(6) not null unique,
  join_code_rotated_at timestamptz not null default now(),
  member_count integer not null default 0 check (member_count between 0 and 8),
  host_member_id uuid,
  active_round_id uuid,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists family_members (
  member_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family_rooms(family_id) on delete cascade,
  display_name varchar(40) not null,
  token_hash varchar(64) not null unique,
  role varchar(10) not null check (role in ('host','member')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_rooms_host_member_fk'
  ) then
    alter table family_rooms
      add constraint family_rooms_host_member_fk
      foreign key (host_member_id) references family_members(member_id)
      deferrable initially deferred;
  end if;
end $$;

create table if not exists family_rounds (
  round_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family_rooms(family_id) on delete cascade,
  created_by_member_id uuid not null references family_members(member_id),
  status varchar(20) not null check (
    status in ('setup','swiping','finalists','final_swiping','tiebreak','complete','ended')
  ),
  decision_type varchar(12) not null check (decision_type in ('meal','restaurant')),
  snapshot jsonb not null default '{}'::jsonb,
  dinner_target_at timestamptz,
  stage_started_at timestamptz,
  stage_deadline_at timestamptz,
  current_stage smallint not null default 1 check (current_stage between 1 and 3),
  winner_item jsonb,
  winner_saved boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'family_rooms_active_round_fk'
  ) then
    alter table family_rooms
      add constraint family_rooms_active_round_fk
      foreign key (active_round_id) references family_rounds(round_id)
      deferrable initially deferred;
  end if;
end $$;

create table if not exists family_round_members (
  round_id uuid not null references family_rounds(round_id) on delete cascade,
  member_id uuid not null references family_members(member_id) on delete cascade,
  included boolean not null default true,
  joined_at timestamptz not null default now(),
  submitted_stage1_at timestamptz,
  submitted_stage2_at timestamptz,
  submitted_tiebreak_at timestamptz,
  last_seen_at timestamptz not null default now(),
  primary key (round_id, member_id)
);

create table if not exists family_votes (
  round_id uuid not null references family_rounds(round_id) on delete cascade,
  stage varchar(12) not null check (stage in ('initial','finalist','tiebreak')),
  member_id uuid not null references family_members(member_id) on delete cascade,
  item_id varchar(160) not null,
  choice varchar(8) not null check (choice in ('cut','maybe','choose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (round_id, stage, member_id, item_id)
);

create table if not exists family_events (
  event_id uuid primary key default gen_random_uuid(),
  family_id uuid not null references family_rooms(family_id) on delete cascade,
  round_id uuid references family_rounds(round_id) on delete set null,
  member_id uuid references family_members(member_id) on delete set null,
  event_type varchar(40) not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_members_family
  on family_members(family_id, active);

create index if not exists idx_family_rounds_family
  on family_rounds(family_id, created_at desc);

create index if not exists idx_family_round_members_round
  on family_round_members(round_id, member_id);

create index if not exists idx_family_votes_round_stage
  on family_votes(round_id, stage);

create index if not exists idx_family_events_family_time
  on family_events(family_id, created_at desc);

update family_rooms fr
set member_count = (
  select count(*)::integer
  from family_members fm
  where fm.family_id = fr.family_id and fm.active = true
);
