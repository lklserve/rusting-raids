-- =====================================================================================
-- Rusting Raids — ADM DO JOGO POR CHAVE
-- Pedido do Ronni (2026-09-27): "quero um botão de dar adm através do painel de chaves, assim eu tenho controle de
-- quem vai ser adm do jogo". Só o painel (service role) muda; o site devolve "adm" no /validar, no /ativar e no
-- bilhete do servidor (M7), e o jogo final só mostra o ADM para essas chaves.
-- Rodar DEPOIS do schema.sql. Só acrescenta: nenhuma chave vira ADM sozinha.
-- =====================================================================================

alter table public.chaves add column if not exists adm    boolean not null default false;
alter table public.chaves add column if not exists adm_em timestamptz;

-- Quem deu ou tirou, e quando (o painel grava; ninguém de fora lê).
create table if not exists public.adm_historico (
  id       bigserial primary key,
  chave_id uuid not null references public.chaves(id) on delete cascade,
  adm      boolean not null,
  em       timestamptz not null default now(),
  ip       text
);
create index if not exists adm_historico_chave_idx on public.adm_historico (chave_id, em desc);

alter table public.adm_historico enable row level security;
revoke all on table public.adm_historico from anon, authenticated;
revoke all on sequence public.adm_historico_id_seq from anon, authenticated;
