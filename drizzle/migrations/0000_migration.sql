create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  delivery_email text,
  digest_email_enabled boolean not null default true,
  audio_digest_enabled boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, delivery_email) values (new.id, new.email) on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  cik integer not null,
  company_name text not null,
  shares numeric,
  avg_price numeric,
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);
grant select, insert, update, delete on public.holdings to authenticated;
grant all on public.holdings to service_role;
alter table public.holdings enable row level security;
create policy "own holdings select" on public.holdings for select to authenticated using (auth.uid() = user_id);
create policy "own holdings insert" on public.holdings for insert to authenticated with check (auth.uid() = user_id);
create policy "own holdings update" on public.holdings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own holdings delete" on public.holdings for delete to authenticated using (auth.uid() = user_id);

create table public.companies (
  cik integer primary key,
  ticker text not null,
  name text not null,
  description text,
  sic_description text,
  exchanges text[],
  fiscal_year_end text,
  submissions_fetched_at timestamptz,
  facts_fetched_at timestamptz
);
grant select on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;
create policy "companies readable" on public.companies for select to authenticated using (true);

create table public.filings (
  accession text primary key,
  cik integer not null,
  form text not null,
  filing_date date not null,
  report_date date,
  primary_document text,
  description text,
  items text
);
create index filings_cik_date on public.filings (cik, filing_date desc);
grant select on public.filings to authenticated;
grant all on public.filings to service_role;
alter table public.filings enable row level security;
create policy "filings readable" on public.filings for select to authenticated using (true);

create table public.financial_facts (
  cik integer primary key,
  currency text not null,
  fiscal_year_end_month integer not null,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
grant select on public.financial_facts to authenticated;
grant all on public.financial_facts to service_role;
alter table public.financial_facts enable row level security;
create policy "facts readable" on public.financial_facts for select to authenticated using (true);