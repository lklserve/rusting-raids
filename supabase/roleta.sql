-- =====================================================================================================================
-- Rusting Raids — A ROLETA DE HALLOWEEN (22/10, jogo-25). O Ronni: "sobre a roleta, como o personagem vai ganhar as skins,
-- eu quero que seja roleta. Então, faça uma roleta igual como eu vou estar mostrando aí" (a roleta sem repetição do LIOS
-- 2026, ui/nonrepeatedluckturntablepanel_gyxy: o quadro "HALLOWEEN" com 10 cartazes). Depois: "coloque mais prêmios, os
-- mesmos do LIOS de 2026, a skin de personagem e as outras coisas também" — o quadro passou a 16 cartazes, com os 9 prêmios
-- do conjunto "Coruja Sombra da Noite" (诡夜枭影) da roleta de Halloween de 2026 (a fórmula do Motoplanador ficou de fora:
-- o jogo não tem planador).
--
-- Como funciona (a NonRepeatedLuckTurntable de 2026):
-- - 16 prêmios no quadro (roleta_premios); cada giro dá UM que a chave ainda não tem — sem repetição —, sorteado aqui no
--   banco pelo peso (o jogo só mostra);
-- - o preço sobe a cada giro: roletas.precos[n] é o n-ésimo giro da chave. Quem já tem um dos prêmios (comprou na loja)
--   não gira por ele: precisa de menos giros;
-- - o prêmio vai para itens_da_chave, como uma compra (vale em todo aparelho da chave), e o livro-caixa ganha o tipo
--   'roleta' (com o item e o preço);
-- - cada giro traz um giro_id (o jogo gera): o mesmo giro_id de novo (o jogo tentou outra vez sem resposta) devolve o mesmo
--   prêmio e NÃO cobra outra vez;
-- - fora de [inicio, fim] não gira (o evento vai até 08/11 23:59 de Brasília, como o EventoDeHalloween do jogo).
-- A Raider Abóbora (9300089, a skin do evento), a SMG de esqueleto (210169001, Metralhadora SMG | Ossuário) e os 9 do
-- conjunto de 2026 entram na loja_itens DESLIGADOS: não se vendem, só saem na roleta. Os 5 de Halloween que já estavam na
-- loja (as 2 mochilas, as 2 abóboras e a Bazuca) continuam à venda; quem os comprou gira menos vezes.
--
-- Rodar UMA vez no SQL Editor do Supabase. Pode rodar de novo: atualiza preços, datas e prêmios (os giros feitos ficam).
-- NÃO roda sozinho: o Ronni manda. Testado no PGlite (testes/roleta_sql_teste.mjs).
-- =====================================================================================================================
begin;

-- O livro-caixa ganha o tipo 'roleta' (a lista de hoje é a do apelido.sql).
alter table public.cupons_movimentos drop constraint if exists cupons_movimentos_tipo_check;
alter table public.cupons_movimentos add constraint cupons_movimentos_tipo_check
  check (tipo in ('recarga', 'compra', 'assinatura', 'apelido', 'ajuste', 'estorno', 'roleta'));

create table if not exists public.roletas (
  id      text primary key,
  nome    text not null,
  precos  integer[] not null check (array_length(precos, 1) between 1 and 20 and 0 < all (precos)),
  inicio  timestamptz not null,
  fim     timestamptz not null,
  ativa   boolean not null default true
);

create table if not exists public.roleta_premios (
  roleta_id  text not null references public.roletas(id) on delete cascade,
  item_id    integer not null references public.loja_itens(id),
  vaga       smallint not null check (vaga between 1 and 20),
  peso       integer not null default 10 check (peso > 0),
  primary key (roleta_id, item_id),
  unique (roleta_id, vaga)
);

create table if not exists public.roleta_giros (
  id         bigserial primary key,
  roleta_id  text not null references public.roletas(id),
  chave_id   uuid not null references public.chaves(id) on delete cascade,
  giro_id    uuid not null unique,
  item_id    integer not null references public.loja_itens(id),
  preco      integer not null,
  criado_em  timestamptz not null default now()
);
create index if not exists roleta_giros_chave_idx on public.roleta_giros (chave_id, roleta_id);

alter table public.roletas        enable row level security;
alter table public.roleta_premios enable row level security;
alter table public.roleta_giros   enable row level security;
revoke all on table public.roletas, public.roleta_premios, public.roleta_giros from public, anon, authenticated;
grant select on table public.roletas, public.roleta_premios to service_role;
grant select, insert on table public.roleta_giros to service_role;
grant usage on sequence public.roleta_giros_id_seq to service_role;

-- As exclusivas do evento: na loja_itens para valer como item da chave, mas desligadas (não aparecem na loja). O preço
-- não vale (ninguém compra); é o da raridade, para o caso de um dia irem à venda.
insert into public.loja_itens (id, categoria, nome, preco_cupons, ativo, ordem) values
  (9300089, 'personagem', 'Raider Abóbora', 300, false, 8999),
  (210169001, 'arma', 'Metralhadora SMG | Ossuário', 300, false, 8998),
  (150485, 'personagem', 'Noite Sinistra', 300, false, 8997),
  (223250060, 'arma', 'Rifle M762 | Coruja Sombra da Noite', 300, false, 8996),
  (225140050, 'arma', 'Rifle de Conversão de Calibre | Coruja Sombra da Noite', 150, false, 8995),
  (100440610, 'arma', 'Facão | Coruja Sombra da Noite', 150, false, 8994),
  (601040500, 'base', 'Caixa Grande | Coruja Sombra da Noite', 150, false, 8993),
  (650940500, 'base', 'Grande Forja | Coruja Sombra da Noite', 150, false, 8992),
  (600640540, 'base', 'Gabinete Territorial | Coruja Sombra da Noite', 150, false, 8991),
  (85266, 'moldura', 'Moldura | Coruja Sombra da Noite', 100, false, 8990),
  (100175, 'balao', 'Bolha de Chat | Coruja Sombra da Noite', 100, false, 8989)
on conflict (id) do nothing;

-- O preço de cada giro: 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150 (1160 cupons os 16, R$ 58).
insert into public.roletas (id, nome, precos, inicio, fim, ativa) values
  ('halloween', 'Roleta de Halloween', array[20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150],
   '2026-10-22 00:00:00-03', '2026-11-08 23:59:59-03', true)
on conflict (id) do update set nome = excluded.nome, precos = excluded.precos, inicio = excluded.inicio,
  fim = excluded.fim, ativa = excluded.ativa;

-- Os 16 prêmios, na vaga do quadro (a ordem do RoletaDoSite.PremiosDeHalloween no jogo; 11 a 16 são os cartazes de papel
-- pregados nos vãos do quadro). Peso (soma 124): a skin do evento sai pouco nos primeiros giros (2), como o prêmio grande do
-- 2026; a Noite Sinistra e a SMG de esqueleto, 3; o M762 e a Abóbora Flamejantes, 5; o comum, 10; moldura e balão, 12.
delete from public.roleta_premios where roleta_id = 'halloween';
insert into public.roleta_premios (roleta_id, item_id, vaga, peso) values
  ('halloween', 100440610,  1, 10),  -- Facão | Coruja Sombra da Noite (2026)
  ('halloween', 100175,     2, 12),  -- Bolha de Chat | Coruja Sombra da Noite (2026)
  ('halloween', 210169001,  3,  3),  -- Metralhadora SMG | Ossuário (a SMG de esqueleto; "essa arma vai pra roleta também")
  ('halloween', 225140050,  4,  8),  -- Rifle de Conversão de Calibre | Coruja Sombra da Noite (2026)
  ('halloween', 600640540,  5, 10),  -- Gabinete Territorial | Coruja Sombra da Noite (2026)
  ('halloween', 150055,     6,  5),  -- Abóbora Flamejantes (personagem)
  ('halloween', 650940500,  7, 10),  -- Grande Forja | Coruja Sombra da Noite (2026)
  ('halloween', 157002,     8, 10),  -- Monstrinho de Halloween | Mochila
  ('halloween', 9300089,    9,  2),  -- Raider Abóbora (o cartaz alto do meio)
  ('halloween', 150485,    10,  3),  -- Noite Sinistra (personagem de 2026; o cartaz alto da direita)
  ('halloween', 601040500, 11, 10),  -- Caixa Grande | Coruja Sombra da Noite (2026)
  ('halloween', 250140010, 12,  8),  -- Bazuca Feroz | Monstrinho
  ('halloween', 85266,     13, 12),  -- Moldura | Coruja Sombra da Noite (2026)
  ('halloween', 223250060, 14,  5),  -- Rifle M762 | Coruja Sombra da Noite (2026)
  ('halloween', 150004,    15,  6),  -- Abóbora Sedenta de Sangue (personagem)
  ('halloween', 157078,    16, 10);  -- Festa de Halloween | Mochila

-- ----------------------------------------------------------------- o giro (atômico)
-- Trava o saldo da chave (dois giros da mesma chave ficam em fila), confere o giro_id repetido, sorteia entre os prêmios que
-- a chave não tem, cobra o preço do giro e entrega. O preço sai SÓ da tabela.
create or replace function public.girar_roleta(p_chave uuid, p_roleta text, p_giro uuid)
returns table (ok boolean, erro text, saldo integer, item_id integer, preco integer, giros integer, repetida boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_r roletas%rowtype;
  v_saldo integer; v_feitos integer; v_preco integer; v_item integer; v_total integer; v_sorteio integer;
  v_dono uuid;
begin
  insert into cupons_saldo (chave_id) values (p_chave) on conflict (chave_id) do nothing;
  select s.saldo into v_saldo from cupons_saldo s where s.chave_id = p_chave for update;

  -- O mesmo giro de novo: o resultado de antes, sem cobrar.
  select g.chave_id, g.item_id, g.preco into v_dono, v_item, v_preco from roleta_giros g where g.giro_id = p_giro;
  if v_dono is not null then
    if v_dono <> p_chave then
      return query select false, 'Giro inválido.'::text, v_saldo, null::integer, 0, 0, false; return;
    end if;
    select count(*)::integer into v_feitos from roleta_giros g where g.chave_id = p_chave and g.roleta_id = p_roleta;
    return query select true, null::text, v_saldo, v_item, v_preco, v_feitos, true; return;
  end if;

  select * into v_r from roletas r where r.id = p_roleta;
  if not found or not v_r.ativa then
    return query select false, 'Roleta indisponível.'::text, v_saldo, null::integer, 0, 0, false; return;
  end if;
  if now() < v_r.inicio then
    return query select false, 'A roleta ainda não abriu.'::text, v_saldo, null::integer, 0, 0, false; return;
  end if;
  if now() > v_r.fim then
    return query select false, 'O evento acabou.'::text, v_saldo, null::integer, 0, 0, false; return;
  end if;

  select count(*)::integer into v_feitos from roleta_giros g where g.chave_id = p_chave and g.roleta_id = p_roleta;
  select sum(p.peso)::integer into v_total from roleta_premios p
    where p.roleta_id = p_roleta
      and not exists (select 1 from itens_da_chave i where i.chave_id = p_chave and i.item_id = p.item_id);
  if v_total is null then
    return query select false, 'Você já ganhou todos os prêmios.'::text, v_saldo, null::integer, 0, v_feitos, false; return;
  end if;

  v_preco := v_r.precos[least(v_feitos + 1, array_length(v_r.precos, 1))];
  if v_saldo < v_preco then
    return query select false, 'Cupons insuficientes.'::text, v_saldo, null::integer, v_preco, v_feitos, false; return;
  end if;

  -- O sorteio pelo peso: um número em [0, total) cai na faixa acumulada de um prêmio (na ordem das vagas).
  v_sorteio := floor(random() * v_total)::integer;
  select x.item_id into v_item from (
    select p.item_id, p.vaga, sum(p.peso) over (order by p.vaga) as ate
    from roleta_premios p
    where p.roleta_id = p_roleta
      and not exists (select 1 from itens_da_chave i where i.chave_id = p_chave and i.item_id = p.item_id)
  ) x where x.ate > v_sorteio order by x.vaga limit 1;

  update cupons_saldo set saldo = cupons_saldo.saldo - v_preco, atualizado_em = now()
    where cupons_saldo.chave_id = p_chave returning cupons_saldo.saldo into v_saldo;
  insert into itens_da_chave (chave_id, item_id) values (p_chave, v_item);
  insert into roleta_giros (roleta_id, chave_id, giro_id, item_id, preco) values (p_roleta, p_chave, p_giro, v_item, v_preco);
  insert into cupons_movimentos (chave_id, tipo, cupons, item_id, observacao)
    values (p_chave, 'roleta', -v_preco, v_item, p_roleta || ' giro ' || (v_feitos + 1));
  return query select true, null::text, v_saldo, v_item, v_preco, v_feitos + 1, false;
end $$;

revoke all on function public.girar_roleta(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.girar_roleta(uuid, text, uuid) to service_role;

commit;
