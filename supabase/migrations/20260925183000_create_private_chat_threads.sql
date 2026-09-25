create table public.chat_threads (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array' and octet_length(messages::text) <= 250000),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);
alter table public.chat_threads enable row level security;

create policy "Students read own chats" on public.chat_threads for select to authenticated using ((select auth.uid()) = user_id);
create policy "Students create own chats" on public.chat_threads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Students update own chats" on public.chat_threads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Students delete own chats" on public.chat_threads for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.chat_threads from anon;
grant select, insert, update, delete on public.chat_threads to authenticated;
