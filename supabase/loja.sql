-- =====================================================================================
-- Rusting Raids — LOJA DE SKINS E CUPONS (2026-09-26)
-- Decisões do Ronni: 20 cupons = R$ 1; toda skin custa 300 cupons; a skin é para sempre e vale
-- em todos os aparelhos da CHAVE; só visual. O saldo e as skins moram aqui, nunca no celular.
-- Só a service role acessa (RLS ligada, sem políticas). Rodar depois do schema.sql.
-- =====================================================================================

-- ----------------------------------------------------------------- recarga pelo Pix
-- O pedido de recarga usa a mesma tabela do apoio: tipo 'recarga', a chave que recebe os cupons,
-- o pacote e quantos cupons (já com o bônus) ele credita.
alter table public.pedidos add column if not exists tipo text not null default 'chave';
alter table public.pedidos drop constraint if exists pedidos_tipo_check;
alter table public.pedidos add constraint pedidos_tipo_check check (tipo in ('chave', 'recarga'));
alter table public.pedidos add column if not exists recarga_chave_id uuid references public.chaves(id);
alter table public.pedidos add column if not exists pacote_id text;
alter table public.pedidos add column if not exists cupons integer;

-- Os pacotes que o site vende (o navegador manda só o id; preço e cupons saem daqui).
create table if not exists public.loja_pacotes (
  id      text primary key,               -- texto ("p15"): o JsonUtility da Unity não lê número em campo de texto
  reais   numeric(10,2) not null check (reais > 0),
  cupons  integer not null check (cupons > 0),
  bonus   integer not null default 0 check (bonus >= 0),
  ativo   boolean not null default true,
  ordem   integer not null default 0
);
insert into public.loja_pacotes (id, reais, cupons, bonus, ordem) values
  ('p15',   15,  300,   0, 1),
  ('p30',   30,  600,  30, 2),
  ('p75',   75, 1500, 150, 3),
  ('p150', 150, 3000, 450, 4)
on conflict (id) do update set reais = excluded.reais, cupons = excluded.cupons, bonus = excluded.bonus, ordem = excluded.ordem;

-- ----------------------------------------------------------------- saldo e livro-caixa
create table if not exists public.cupons_saldo (
  chave_id      uuid primary key references public.chaves(id) on delete cascade,
  saldo         integer not null default 0 check (saldo >= 0),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cupons_movimentos (
  id        bigserial primary key,
  chave_id  uuid not null references public.chaves(id) on delete cascade,
  tipo      text not null check (tipo in ('recarga', 'compra', 'ajuste', 'estorno')),
  cupons    integer not null,              -- + entra, − sai
  pedido_id uuid unique references public.pedidos(id),   -- unique: o webhook credita uma vez só
  item_id   integer,
  observacao text,                         -- ajuste manual: quem e por quê
  criado_em timestamptz not null default now()
);
alter table public.cupons_movimentos add column if not exists observacao text;
create index if not exists cupons_movimentos_chave_idx on public.cupons_movimentos (chave_id);

-- ----------------------------------------------------------------- itens
create table if not exists public.loja_itens (
  id            integer primary key,       -- o id do LIOS (ShopCfg/ItemCfg); o maior, 2020010901, cabe em int32
  categoria     text not null check (categoria in ('arma', 'explosivo', 'veiculo', 'moldura', 'balao')),
  nome          text not null,
  preco_cupons  integer not null default 300 check (preco_cupons > 0),
  ativo         boolean not null default true,
  ordem         integer not null default 0
);

create table if not exists public.itens_da_chave (
  chave_id    uuid not null references public.chaves(id) on delete cascade,
  item_id     integer not null references public.loja_itens(id),
  comprado_em timestamptz not null default now(),
  primary key (chave_id, item_id)
);

alter table public.loja_pacotes      enable row level security;
alter table public.cupons_saldo      enable row level security;
alter table public.cupons_movimentos enable row level security;
alter table public.loja_itens        enable row level security;
alter table public.itens_da_chave    enable row level security;

-- ----------------------------------------------------------------- compra (atômica)
-- Trava o saldo da chave, pega o preço SÓ da tabela, não deixa o saldo negativo nem comprar duas vezes.
create or replace function public.comprar_item(p_chave uuid, p_item integer)
returns table (ok boolean, erro text, saldo integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_preco integer; v_saldo integer;
begin
  select l.preco_cupons into v_preco from loja_itens l where l.id = p_item and l.ativo;
  insert into cupons_saldo (chave_id) values (p_chave) on conflict (chave_id) do nothing;
  select s.saldo into v_saldo from cupons_saldo s where s.chave_id = p_chave for update;
  if v_preco is null then
    return query select false, 'Item indisponível.'::text, v_saldo; return;
  end if;
  if exists (select 1 from itens_da_chave i where i.chave_id = p_chave and i.item_id = p_item) then
    return query select false, 'Você já tem este item.'::text, v_saldo; return;
  end if;
  if v_saldo < v_preco then
    return query select false, 'Cupons insuficientes.'::text, v_saldo; return;
  end if;
  update cupons_saldo set saldo = cupons_saldo.saldo - v_preco, atualizado_em = now()
    where cupons_saldo.chave_id = p_chave returning cupons_saldo.saldo into v_saldo;
  insert into itens_da_chave (chave_id, item_id) values (p_chave, p_item);
  insert into cupons_movimentos (chave_id, tipo, cupons, item_id) values (p_chave, 'compra', -v_preco, p_item);
  return query select true, null::text, v_saldo;
end $$;

-- ----------------------------------------------------------------- crédito da recarga (idempotente)
-- Chamado pelo webhook e pela consulta de status: o pedido_id único no livro-caixa garante UM crédito.
create or replace function public.creditar_recarga(p_pedido uuid)
returns table (creditou boolean, cupons integer, saldo integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_chave uuid; v_cupons integer; v_saldo integer; v_mov bigint;
begin
  select p.recarga_chave_id, p.cupons into v_chave, v_cupons
    from pedidos p where p.id = p_pedido and p.tipo = 'recarga' for update;
  if v_chave is null or v_cupons is null then raise exception 'pedido de recarga inválido'; end if;
  insert into cupons_saldo (chave_id) values (v_chave) on conflict (chave_id) do nothing;
  insert into cupons_movimentos (chave_id, tipo, cupons, pedido_id)
    values (v_chave, 'recarga', v_cupons, p_pedido)
    on conflict (pedido_id) do nothing returning id into v_mov;
  if v_mov is not null then
    update cupons_saldo set saldo = cupons_saldo.saldo + v_cupons, atualizado_em = now()
      where cupons_saldo.chave_id = v_chave returning cupons_saldo.saldo into v_saldo;
  else
    select s.saldo into v_saldo from cupons_saldo s where s.chave_id = v_chave;
  end if;
  update pedidos set status = 'aprovado', aprovado_em = coalesce(aprovado_em, now())
    where id = p_pedido and status <> 'aprovado';
  return query select (v_mov is not null), v_cupons, v_saldo;
end $$;

-- As funções são SECURITY DEFINER: ninguém além da service role pode chamá-las pela API.
revoke all on function public.comprar_item(uuid, integer)  from public, anon, authenticated;
revoke all on function public.creditar_recarga(uuid)        from public, anon, authenticated;
grant execute on function public.comprar_item(uuid, integer) to service_role;
grant execute on function public.creditar_recarga(uuid)      to service_role;
