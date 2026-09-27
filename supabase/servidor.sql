-- =====================================================================================
-- Rusting Raids — MONITOR DO SERVIDOR DO JOGO (M7, _Placeholder/servidor_m7/PLANO.md §3)
-- O servidor da VPS manda o estado a cada 30 s (POST /api/servidor/estado, segredo SERVIDOR_SEGREDO) e o painel
-- de chaves mostra na aba "Servidor". Só a service role acessa (RLS ligada, sem políticas).
-- =====================================================================================

create table if not exists public.servidor_estado (
  servidor      text primary key,                       -- 'principal' (um por máquina/porta, se um dia houver mais)
  visto_em      timestamptz not null default now(),     -- último aviso: mais de 90 s sem aviso = fora do ar
  versao        text,                                   -- "1/5A3F09C2" (ProtocoloDaRede.Texto)
  online        integer not null default 0,
  jogadores     jsonb not null default '[]'::jsonb,     -- [{jogador, roleId, nome, adm}]
  memoria_mb    integer,
  ligado_s      bigint,                                 -- segundos desde que o processo abriu
  hora_do_mundo text,                                   -- "14:05" do ciclo do dia
  temporada_fim timestamptz,                            -- o fim das 168 h da temporada do servidor
  ip            text
);

create table if not exists public.servidor_historico (
  id         bigserial primary key,
  servidor   text not null,
  em         timestamptz not null default now(),
  online     integer not null,
  memoria_mb integer
);
create index if not exists servidor_historico_em_idx on public.servidor_historico (servidor, em desc);

alter table public.servidor_estado    enable row level security;
alter table public.servidor_historico enable row level security;
revoke all on table public.servidor_estado, public.servidor_historico from anon, authenticated;
revoke all on sequence public.servidor_historico_id_seq from anon, authenticated;

-- Suspeitos (2026-09-27): as ocorrências da auditoria do servidor que dizem respeito a trapaça — "vitais" (o servidor
-- corrigiu o aparelho) e "vitais-desligado" (ignorou 3 correções). O painel lista por jogador, com o botão de banir.
create table if not exists public.servidor_ocorrencias (
  id       bigserial primary key,
  servidor text not null,
  em       timestamptz not null default now(),
  jogador  uuid not null,                 -- jogadores.id (a conta do bilhete)
  role_id  text,
  nome     text,
  op       text not null check (op in ('vitais', 'vitais-desligado')),
  motivo   text
);
create index if not exists servidor_ocorrencias_em_idx on public.servidor_ocorrencias (em desc);
create index if not exists servidor_ocorrencias_jogador_idx on public.servidor_ocorrencias (jogador, em desc);
alter table public.servidor_ocorrencias enable row level security;
revoke all on table public.servidor_ocorrencias from anon, authenticated;
revoke all on sequence public.servidor_ocorrencias_id_seq from anon, authenticated;

-- CPU e quadros por segundo do servidor (2026-09-27, as criaturas da M5-a rodam no servidor): médias entre avisos.
alter table public.servidor_estado    add column if not exists cpu real;   -- % da máquina inteira
alter table public.servidor_estado    add column if not exists qps real;   -- quadros por segundo do servidor
alter table public.servidor_historico add column if not exists cpu real;
