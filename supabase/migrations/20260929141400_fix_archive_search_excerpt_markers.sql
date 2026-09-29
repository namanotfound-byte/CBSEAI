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
           'MaxWords=24, MinWords=8, MaxFragments=1, StartSel=[, StopSel=]')
  from padhle_archive.page_text as t
  join padhle_archive.source_pages as p on p.text_sha256 = t.text_sha256
  where t.search_vector @@ search_query
    and (subject_filter is null or p.subject = subject_filter)
  order by ts_rank_cd(t.search_vector, search_query) desc, p.source_id, p.page
  limit safe_limit;
end
$function$;
