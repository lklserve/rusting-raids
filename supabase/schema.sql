-- ============================================================================
-- Rusting Raids — banco de licenças e pedidos.
-- Projeto Supabase DEDICADO ao jogo. Não tem relação com nenhum outro produto.
-- Rode este arquivo inteiro no SQL Editor do projeto novo (uma vez).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- pedidos
-- Um pedido por tentativa de Pix. A chave só nasce quando o pagamento é aprovado.
create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  valor          numeric(10,2) not null,
  status         text not null default 'pendente'
                   check (status in ('pendente','aprovado','expirado','cancelado')),
  payment_id     text,                    -- id do pagamento no Mercado Pago
  pix_copia_cola text,
  pix_qr_base64  text,
  chave_id       uuid,                    -- preenchido quando a chave é emitida
  expira_em      timestamptz,
  criado_em      timestamptz not null default now(),
  aprovado_em    timestamptz
);
create index if not exists pedidos_payment_id_idx on public.pedidos (payment_id);
create index if not exists pedidos_email_idx      on public.pedidos (lower(email));
create index if not exists pedidos_status_idx     on public.pedidos (status);

-- ----------------------------------------------------------------- chaves
-- A chave de acesso que o apoiador recebe. Uma por pedido aprovado.
create table if not exists public.chaves (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,       -- RR-XXXX-XXXX
  email       text not null,
  status      text not null default 'ativa' check (status in ('ativa','banida')),
  pedido_id   uuid unique,                -- unique: no máximo 1 chave por pedido (corrida webhook×polling)
  valor_pago  numeric(10,2),
  criado_em   timestamptz not null default now(),
  ultimo_uso  timestamptz,
  observacao  text
);
create index if not exists chaves_email_idx on public.chaves (lower(email));

-- Amarra as duas tabelas depois de existirem.
alter table public.pedidos drop constraint if exists pedidos_chave_fk;
alter table public.pedidos
  add constraint pedidos_chave_fk foreign key (chave_id) references public.chaves(id);
alter table public.chaves drop constraint if exists chaves_pedido_fk;
alter table public.chaves
  add constraint chaves_pedido_fk foreign key (pedido_id) references public.pedidos(id);

-- ----------------------------------------------------------------- jogadores
-- A conta que o jogador cria dentro do jogo ao ativar a chave.
-- Guarda o ID do aparelho para o banimento e o limite de dispositivos.
create table if not exists public.jogadores (
  id            uuid primary key default gen_random_uuid(),
  chave_id      uuid not null references public.chaves(id) on delete cascade,
  device_id     text not null,
  nome          text,
  banido        boolean not null default false,
  motivo_ban    text,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz,
  unique (chave_id, device_id)
);
create index if not exists jogadores_device_idx on public.jogadores (device_id);
create index if not exists jogadores_chave_idx  on public.jogadores (chave_id);

-- ----------------------------------------------------------------- rate_limit
-- Anti-abuso simples (por e-mail/aparelho), para não estourar a API do Mercado Pago.
create table if not exists public.rate_limit (
  chave     text primary key,
  contador  int not null default 0,
  janela_em timestamptz not null default now()
);

-- ----------------------------------------------------------------- segurança
-- RLS ligado e SEM policies: ninguém com a chave pública (anon) lê ou escreve.
-- Só as funções da Vercel, que usam a service_role, acessam (a service_role ignora RLS).
alter table public.pedidos    enable row level security;
alter table public.chaves     enable row level security;
alter table public.jogadores  enable row level security;
alter table public.rate_limit enable row level security;

-- ----------------------------------------------------------------- painel (visão)
-- Números prontos para o painel de administração.
create or replace view public.painel_resumo as
  select
    (select count(*) from public.chaves where status = 'ativa')                        as chaves_ativas,
    (select count(*) from public.chaves where status = 'banida')                       as chaves_banidas,
    (select count(*) from public.jogadores)                                            as jogadores,
    (select count(*) from public.jogadores where banido)                               as jogadores_banidos,
    (select count(*) from public.pedidos where status = 'aprovado')                    as pedidos_pagos,
    (select coalesce(sum(valor),0) from public.pedidos where status = 'aprovado')      as total_arrecadado,
    -- O mês é o de Brasília (o banco roda em UTC): começa à 00:00 de São Paulo.
    (select coalesce(sum(valor),0) from public.pedidos
       where status = 'aprovado'
         and aprovado_em >= (date_trunc('month', now() at time zone 'America/Sao_Paulo')
                             at time zone 'America/Sao_Paulo'))               as arrecadado_no_mes;
