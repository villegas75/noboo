-- Pega esto en Supabase > SQL Editor > Run (añade los retos entre cuentas)

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  creator uuid not null references auth.users on delete cascade,
  opponent uuid references auth.users on delete set null,
  creator_name text,
  opponent_name text,
  creator_goal text not null default 'muscle',
  opponent_goal text not null default 'muscle',
  status text not null default 'open',   -- open | active | done
  winner uuid references auth.users on delete set null,
  draw boolean not null default false,
  created_at timestamptz default now()
);

create table public.challenge_entries (
  challenge_id uuid references public.challenges on delete cascade,
  user_id uuid references auth.users on delete cascade,
  name text,
  goal text,
  score int,
  confidence text,
  note text,
  created_at timestamptz default now(),
  primary key (challenge_id, user_id)
);

create table public.player_stats (
  user_id uuid primary key references auth.users on delete cascade,
  played int not null default 0,
  wins int not null default 0
);

-- Sin políticas: solo el servidor puede leer y escribir (nadie ve fotos ni datos ajenos)
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.player_stats enable row level security;
