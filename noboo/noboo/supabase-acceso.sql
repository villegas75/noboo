-- Pega esto en Supabase > SQL Editor > Run (control de acceso por correo)

create table public.access_list (
  email text primary key,                                   -- siempre en minúsculas
  mode text not null check (mode in ('allow', 'deny')),     -- allow = acceso concedido, deny = bloqueado
  note text,
  created_at timestamptz default now()
);

-- Sin políticas: solo el servidor (y tu panel de administración) pueden leerla y escribirla
alter table public.access_list enable row level security;
