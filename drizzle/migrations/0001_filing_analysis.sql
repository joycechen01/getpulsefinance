create table public.filing_extractions (
  accession text primary key,
  cik bigint not null,
  status text not null,
  section_counts jsonb not null default '{}'::jsonb,
  extracted_at timestamptz not null default now()
);
grant select on public.filing_extractions to authenticated;
grant all on public.filing_extractions to service_role;
alter table public.filing_extractions enable row level security;
create policy "read extractions" on public.filing_extractions for select to authenticated using (true);

create table public.filing_passages (
  id bigserial primary key,
  accession text not null,
  cik bigint not null,
  section text not null,
  pos int not null,
  body text not null,
  tsv tsvector generated always as (to_tsvector('english', body)) stored,
  unique (accession, section, pos)
);
create index filing_passages_cik_idx on public.filing_passages (cik);
create index filing_passages_tsv_idx on public.filing_passages using gin (tsv);
grant select on public.filing_passages to authenticated;
grant all on public.filing_passages to service_role;
grant usage, select on sequence public.filing_passages_id_seq to service_role;
alter table public.filing_passages enable row level security;
create policy "read passages" on public.filing_passages for select to authenticated using (true);

create table public.redlines (
  accession text primary key,
  prior_accession text not null,
  cik bigint not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
grant select on public.redlines to authenticated;
grant all on public.redlines to service_role;
alter table public.redlines enable row level security;
create policy "read redlines" on public.redlines for select to authenticated using (true);

create table public.signal_analyses (
  accession text primary key,
  cik bigint not null,
  signal_count int not null default 0,
  analyzed_at timestamptz not null default now()
);
grant select on public.signal_analyses to authenticated;
grant all on public.signal_analyses to service_role;
alter table public.signal_analyses enable row level security;
create policy "read analyses" on public.signal_analyses for select to authenticated using (true);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  cik bigint not null,
  accession text not null,
  filed_date date,
  category text not null,
  title text not null,
  what_happened text not null,
  whats_new text not null,
  why_it_matters text not null,
  history text not null,
  uncertain text not null,
  confidence text not null,
  passage_ids bigint[] not null default '{}',
  metric_note text,
  created_at timestamptz not null default now()
);
create index signals_cik_idx on public.signals (cik, filed_date desc);
grant select on public.signals to authenticated;
grant all on public.signals to service_role;
alter table public.signals enable row level security;
create policy "read signals" on public.signals for select to authenticated using (true);

create or replace function public.search_passages(_cik bigint, _q text, _limit int default 10)
returns table (id bigint, accession text, section text, pos int, body text, rank real)
language sql stable set search_path = public as $fn$
  select p.id, p.accession, p.section, p.pos, p.body, ts_rank(p.tsv, x.q) as rank
  from public.filing_passages p,
       (select case when querytree(q0) = 'T' or querytree(q0) = '' then q0
               else to_tsquery('english', replace(querytree(q0), '&', '|')) end as q
        from websearch_to_tsquery('english', _q) q0) x
  where p.cik = _cik and p.tsv @@ x.q
  order by rank desc
  limit _limit
$fn$;
grant execute on function public.search_passages(bigint, text, int) to authenticated, service_role;