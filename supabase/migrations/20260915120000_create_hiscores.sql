-- Skapar hiscores-tabellen för Brick Break i det nya Supabase-projektet.
-- Speglar det schema som tidigare skapades manuellt i Studio (aldrig
-- versionshanterat) – se CLAUDE.md för bakgrund kring migreringen.
--
-- Tabellen läggs i ett eget schema ("brick-break") istället för public,
-- så namnet måste citeras (bindestreck är inte giltigt i ett ocitat
-- identifierarnamn i Postgres).

create schema if not exists "brick-break";

create table if not exists "brick-break".hiscores (
  -- Surrogatnyckel, inte exponerad i klienten (den läser bara name/score)
  id bigint generated always as identity primary key,

  -- 1–3 tecken A–Z/0–9, saneras redan i Edge Function men skyddas
  -- även på databasnivå ifall tabellen nås på annat sätt
  name text not null check (char_length(name) between 1 and 3),

  -- Samma övre gräns som valideras i submit-score/index.ts
  score integer not null check (score >= 0 and score <= 999999),

  created_at timestamptz not null default now()
);

-- Index för topp-10-frågan (order by score desc limit 10)
create index if not exists hiscores_score_idx on "brick-break".hiscores (score desc);

-- Rad-nivå-säkerhet: utan detta kan anon-nyckeln göra vad som helst
alter table "brick-break".hiscores enable row level security;

-- Klienten (anon-nyckel) får bara läsa topplistan
create policy "Anon kan läsa hiscores"
  on "brick-break".hiscores
  for select
  to anon
  using (true);

-- Ingen insert/update/delete-policy skapas för anon eller authenticated –
-- endast service_role (används av Edge Function submit-score) kan skriva,
-- och service_role kringgår RLS helt per Supabase-design.

-- PostgREST exponerar bara scheman som listas i api.schemas (config.toml) –
-- ge även anon-rollen USAGE på schemat, annars nekas åtkomst trots policyn ovan.
grant usage on schema "brick-break" to anon, authenticated, service_role;
grant select on "brick-break".hiscores to anon;
grant all on "brick-break".hiscores to service_role;
