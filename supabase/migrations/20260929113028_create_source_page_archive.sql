create schema if not exists padhle_archive;

revoke all on schema padhle_archive from public, anon, authenticated;
grant usage on schema padhle_archive to authenticated, service_role;

create table padhle_archive.page_text (
  text_sha256 text primary key check (text_sha256 ~ '^[0-9a-f]{64}$'),
  text text not null,
  text_chars integer not null check (text_chars = char_length(text)),
  search_vector tsvector generated always as (to_tsvector('simple'::regconfig, text)) stored,
  created_at timestamptz not null default now()
);

create index page_text_search_vector_idx
  on padhle_archive.page_text using gin (search_vector);

create table padhle_archive.source_pages (
  source_id text not null,
  subject text not null check (subject in ('maths', 'science')),
  source_path text not null,
  archive_member text,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  page integer not null check (page > 0),
  page_sha256 text check (page_sha256 is null or page_sha256 ~ '^[0-9a-f]{64}$'),
  page_sha256_kind text not null,
  text_sha256 text references padhle_archive.page_text(text_sha256),
  text_chars integer not null check (text_chars >= 0),
  extraction_status text not null,
  page_type text,
  extraction_source text,
  raw_page_approved boolean not null default false check (raw_page_approved = false),
  archive_status text not null default 'raw_page_unverified' check (archive_status = 'raw_page_unverified'),
  ingested_at timestamptz not null default now(),
  primary key (source_id, page)
);

create index source_pages_subject_idx on padhle_archive.source_pages (subject);
create index source_pages_text_sha_idx on padhle_archive.source_pages (text_sha256);

alter table padhle_archive.page_text enable row level security;
alter table padhle_archive.source_pages enable row level security;

revoke all on padhle_archive.page_text, padhle_archive.source_pages
  from public, anon, authenticated, service_role;

-- This function returns only a small search excerpt and citation metadata.
-- It never returns the stored page body. The auth check protects its definer rights.
create or replace function padhle_archive.search_source_page_archive_impl(
  query_text text,
  match_limit integer default 10,
  subject_filter text default null
)
returns table (
  source_id text,
  subject text,
  source_path text,
  archive_member text,
  source_sha256 text,
  page integer,
  page_sha256 text,
  page_sha256_kind text,
  text_sha256 text,
  text_chars integer,
  review_status text,
  archive_status text,
  page_type text,
  rank real,
  citation text,
  excerpt text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, padhle_archive
as $function$
declare
  search_query tsquery;
  safe_limit integer;
begin
  if auth.uid() is null
     or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     or not exists (
       select 1
       from auth.users as owner_user
       where owner_user.id = auth.uid()
         and lower(owner_user.email) = 'naman070609@gmail.com'
         and owner_user.email_confirmed_at is not null
     ) then
    raise exception using errcode = '42501', message = 'archive owner session required';
  end if;

  if query_text is null or char_length(btrim(query_text)) = 0 or char_length(query_text) > 300 then
    raise exception using errcode = '22023', message = 'query_text must contain 1 to 300 characters';
  end if;
  if subject_filter is not null and subject_filter not in ('maths', 'science') then
    raise exception using errcode = '22023', message = 'subject_filter must be maths, science, or null';
  end if;

  safe_limit := greatest(1, least(coalesce(match_limit, 10), 25));
  search_query := websearch_to_tsquery('simple'::regconfig, btrim(query_text));

  return query
  select p.source_id, p.subject, p.source_path, p.archive_member, p.source_sha256,
         p.page, p.page_sha256, p.page_sha256_kind, p.text_sha256, p.text_chars,
         p.extraction_status, p.archive_status, p.page_type,
         ts_rank_cd(t.search_vector, search_query)::real,
         p.source_path || ', PDF page ' || p.page::text,
         ts_headline('simple'::regconfig, t.text, search_query,
           'MaxWords=24, MinWords=8, MaxFragments=1, StartSel=, StopSel=')
  from padhle_archive.page_text as t
  join padhle_archive.source_pages as p on p.text_sha256 = t.text_sha256
  where t.search_vector @@ search_query
    and (subject_filter is null or p.subject = subject_filter)
  order by ts_rank_cd(t.search_vector, search_query) desc, p.source_id, p.page
  limit safe_limit;
end
$function$;

revoke all on function padhle_archive.search_source_page_archive_impl(text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function padhle_archive.search_source_page_archive_impl(text, integer, text)
  to authenticated;

create or replace function public.search_source_page_archive(
  query_text text,
  match_limit integer default 10,
  subject_filter text default null
)
returns table (
  source_id text,
  subject text,
  source_path text,
  archive_member text,
  source_sha256 text,
  page integer,
  page_sha256 text,
  page_sha256_kind text,
  text_sha256 text,
  text_chars integer,
  review_status text,
  archive_status text,
  page_type text,
  rank real,
  citation text,
  excerpt text
)
language sql
stable
security invoker
set search_path = pg_catalog, public, padhle_archive
as $function$
  select * from padhle_archive.search_source_page_archive_impl(query_text, match_limit, subject_filter)
$function$;

revoke all on function public.search_source_page_archive(text, integer, text)
  from public, anon;
grant execute on function public.search_source_page_archive(text, integer, text)
  to authenticated;

-- Bulk ingestion is available only through a server-side service-role client.
create or replace function padhle_archive.ingest_source_page_archive_batch(
  payload_rows jsonb,
  page_rows jsonb
)
returns table (payloads_upserted integer, aliases_upserted integer)
language plpgsql
security definer
set search_path = pg_catalog, padhle_archive
as $function$
declare
  payload_count integer;
  page_count integer;
begin
  insert into padhle_archive.page_text (text_sha256, text, text_chars)
  select x.text_sha256, x.text, x.text_chars
  from jsonb_to_recordset(payload_rows) as x(text_sha256 text, text text, text_chars integer)
  on conflict (text_sha256) do update
    set text = excluded.text, text_chars = excluded.text_chars;
  get diagnostics payload_count = row_count;

  insert into padhle_archive.source_pages (
    source_id, subject, source_path, archive_member, source_sha256, page,
    page_sha256, page_sha256_kind, text_sha256, text_chars, extraction_status,
    page_type, extraction_source, raw_page_approved, archive_status
  )
  select x.source_id, x.subject, x.source_path, x.archive_member, x.source_sha256, x.page,
         x.page_sha256, x.page_sha256_kind, x.text_sha256, x.text_chars,
         x.extraction_status, x.page_type, x.extraction_source, false, 'raw_page_unverified'
  from jsonb_to_recordset(page_rows) as x(
    source_id text, subject text, source_path text, archive_member text,
    source_sha256 text, page integer, page_sha256 text, page_sha256_kind text,
    text_sha256 text, text_chars integer, extraction_status text,
    page_type text, extraction_source text
  )
  on conflict (source_id, page) do update set
    subject = excluded.subject,
    source_path = excluded.source_path,
    archive_member = excluded.archive_member,
    source_sha256 = excluded.source_sha256,
    page_sha256 = excluded.page_sha256,
    page_sha256_kind = excluded.page_sha256_kind,
    text_sha256 = excluded.text_sha256,
    text_chars = excluded.text_chars,
    extraction_status = excluded.extraction_status,
    page_type = excluded.page_type,
    extraction_source = excluded.extraction_source,
    raw_page_approved = false,
    archive_status = 'raw_page_unverified';
  get diagnostics page_count = row_count;
  return query select payload_count, page_count;
end
$function$;

revoke all on function padhle_archive.ingest_source_page_archive_batch(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function padhle_archive.ingest_source_page_archive_batch(jsonb, jsonb)
  to service_role;

create or replace function public.ingest_source_page_archive_batch(
  payload_rows jsonb,
  page_rows jsonb
)
returns table (payloads_upserted integer, aliases_upserted integer)
language sql
security invoker
set search_path = pg_catalog, public, padhle_archive
as $function$
  select * from padhle_archive.ingest_source_page_archive_batch(payload_rows, page_rows)
$function$;

revoke all on function public.ingest_source_page_archive_batch(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_source_page_archive_batch(jsonb, jsonb)
  to service_role;
