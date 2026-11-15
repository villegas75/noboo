-- Pega esto en Supabase > SQL Editor > Run

create table public.user_data (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

create table public.subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

create table public.ai_usage (
  user_id uuid references auth.users on delete cascade,
  day date,
  n int not null default 0,
  primary key (user_id, day)
);

alter table public.user_data enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_usage enable row level security;

-- Cada usuario solo ve y escribe SUS datos
create policy "datos propios: leer" on public.user_data for select using (auth.uid() = user_id);
create policy "datos propios: crear" on public.user_data for insert with check (auth.uid() = user_id);
create policy "datos propios: editar" on public.user_data for update using (auth.uid() = user_id);

-- La suscripción solo se LEE desde la app; solo escribe el servidor (webhook de Stripe)
create policy "suscripcion propia: leer" on public.subscriptions for select using (auth.uid() = user_id);

-- ai_usage: sin políticas = solo accesible desde el servidor
