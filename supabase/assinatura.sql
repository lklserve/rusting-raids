-- =====================================================================================
-- Rusting Raids — ASSINATURA DA COLETA AUTOMÁTICA (contrato _Placeholder/farm_automatico/CONTRATO.md §2.1)
-- Pedido do Ronni: a Coleta Automática só é liberada comprada, em cupons: 200 = 15 dias, 300 = 30 dias.
-- O prazo mora aqui, POR CHAVE (vale nos até 3 aparelhos dela), e comprar com prazo ativo SOMA ao fim.
-- Rodar DEPOIS do loja.sql. Só a service role acessa (RLS ligada, sem políticas).
-- =====================================================================================

create table if not exists public.loja_planos (
  id           text primary key,                 -- 'farm_quinzena' | 'farm_mensal' (texto: JsonUtility)
  recurso      text not null check (recurso in ('farm')),
  nome         text not null,
  preco_cupons integer not null check (preco_cupons > 0),
  dias         integer not null check (dias between 1 and 366),
  ativo        boolean not null default true,
  ordem        integer not null default 0
);
insert into public.loja_planos (id, recurso, nome, preco_cupons, dias, ordem) values
  ('farm_quinzena', 'farm', 'Coleta Automática (15 Dias)', 200, 15, 1),
  ('farm_mensal',   'farm', 'Coleta Automática (30 Dias)', 300, 30, 2)
on conflict (id) do update set nome = excluded.nome, preco_cupons = excluded.preco_cupons,
  dias = excluded.dias, ordem = excluded.ordem;

create table if not exists public.assinaturas_da_chave (
  chave_id      uuid not null references public.chaves(id) on delete cascade,
  recurso       text not null,
  ate           timestamptz not null,
  atualizado_em timestamptz not null default now(),
  primary key (chave_id, recurso)
);

-- O livro-caixa ganha o tipo 'assinatura', o plano, a chave de idempotência e o prazo resultante.
alter table public.cupons_movimentos drop constraint if exists cupons_movimentos_tipo_check;
alter table public.cupons_movimentos add constraint cupons_movimentos_tipo_check
  check (tipo in ('recarga', 'compra', 'assinatura', 'ajuste', 'estorno'));
alter table public.cupons_movimentos add column if not exists plano_id   text;
alter table public.cupons_movimentos add column if not exists compra_id  uuid;
alter table public.cupons_movimentos add column if not exists ate_depois timestamptz;
create unique index if not exists cupons_movimentos_compra_idx
  on public.cupons_movimentos (chave_id, compra_id) where compra_id is not null;

alter table public.loja_planos          enable row level security;
alter table public.assinaturas_da_chave enable row level security;
-- Defesa a mais: além da RLS sem política, os papéis públicos nem têm o privilégio da tabela.
revoke all on table public.loja_planos, public.assinaturas_da_chave from anon, authenticated;

-- Atômica. Trava o saldo da chave PRIMEIRO: as compras da mesma chave entram em fila, e a repetida vê a primeira.
create or replace function public.assinar_plano(p_chave uuid, p_plano text, p_compra uuid)
returns table (ok boolean, erro text, saldo integer, ate timestamptz, repetida boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_preco int; v_dias int; v_rec text; v_saldo int; v_ate timestamptz; v_novo timestamptz;
begin
  insert into cupons_saldo (chave_id) values (p_chave) on conflict (chave_id) do nothing;
  select s.saldo into v_saldo from cupons_saldo s where s.chave_id = p_chave for update;
  select a.ate into v_ate from assinaturas_da_chave a where a.chave_id = p_chave and a.recurso = 'farm';
  -- O jogo reenviou (a resposta se perdeu): devolve o estado SEM cobrar de novo. O mesmo compraId com OUTRO
  -- plano não é "a mesma compra": recusa, sem cobrar.
  if exists (select 1 from cupons_movimentos m where m.chave_id = p_chave and m.compra_id = p_compra) then
    if exists (select 1 from cupons_movimentos m where m.chave_id = p_chave and m.compra_id = p_compra
               and m.plano_id is distinct from p_plano) then
      return query select false, 'Compra repetida com outro plano.'::text, v_saldo, v_ate, false; return;
    end if;
    return query select true, null::text, v_saldo, v_ate, true; return;
  end if;
  select l.preco_cupons, l.dias, l.recurso into v_preco, v_dias, v_rec
    from loja_planos l where l.id = p_plano and l.ativo;
  if v_preco is null then
    return query select false, 'Plano indisponível.'::text, v_saldo, v_ate, false; return;
  end if;
  v_novo := greatest(coalesce(v_ate, now()), now()) + make_interval(days => v_dias);
  if v_novo > now() + interval '90 days' then            -- limite para acumular (DECISÃO 6 do contrato)
    return query select false, 'Prazo máximo atingido.'::text, v_saldo, v_ate, false; return;
  end if;
  if v_saldo < v_preco then
    return query select false, 'Cupons insuficientes.'::text, v_saldo, v_ate, false; return;
  end if;
  update cupons_saldo set saldo = cupons_saldo.saldo - v_preco, atualizado_em = now()
    where cupons_saldo.chave_id = p_chave returning cupons_saldo.saldo into v_saldo;
  insert into assinaturas_da_chave (chave_id, recurso, ate) values (p_chave, v_rec, v_novo)
    on conflict (chave_id, recurso) do update set ate = excluded.ate, atualizado_em = now();
  insert into cupons_movimentos (chave_id, tipo, cupons, plano_id, compra_id, ate_depois)
    values (p_chave, 'assinatura', -v_preco, p_plano, p_compra, v_novo);
  return query select true, null::text, v_saldo, v_novo, false;
end $$;
revoke all on function public.assinar_plano(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.assinar_plano(uuid, text, uuid) to service_role;

-- DECISÃO 3 do contrato (Ronni, 2026-09-27: "todas as propostas"): o pacote de R$ 10 = 200 cupons, a quinzena sem sobra.
insert into public.loja_pacotes (id, reais, cupons, bonus, ordem) values ('p10', 10, 200, 0, 0)
  on conflict (id) do update set reais = excluded.reais, cupons = excluded.cupons, bonus = excluded.bonus, ordem = excluded.ordem;
