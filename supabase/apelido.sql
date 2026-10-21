-- O APELIDO DA CHAVE e o Cartão de Renomear (pedido do Ronni, 16/10: "jogadores estão trocando nick toda hora; quero o
-- mesmo sistema do Last de 2026: compra o cartão de trocar nick, o preço é 100 cupons").
--
-- O apelido mora no site, preso à chave (vale em todo aparelho dela), e vai assinado no bilhete de entrada: o servidor
-- do jogo usa ESTE nome, e não o que o aparelho manda. O primeiro é de graça (o jogo o registra no primeiro bilhete, ou
-- pela rota /api/jogo/loja/apelido); trocar depois custa o preço passado pela rota (100 cupons), no livro-caixa como
-- 'apelido'. Rodar UMA vez no SQL Editor do Supabase (idempotente).

create table if not exists public.apelidos_da_chave (
  chave_id    uuid primary key references public.chaves(id) on delete cascade,
  apelido     text not null,
  trocas      integer not null default 0,
  definido_em timestamptz not null default now(),
  trocado_em  timestamptz
);
alter table public.apelidos_da_chave enable row level security;

-- O livro-caixa ganha o tipo 'apelido' (a lista de hoje é a do assinatura.sql).
alter table public.cupons_movimentos drop constraint if exists cupons_movimentos_tipo_check;
alter table public.cupons_movimentos add constraint cupons_movimentos_tipo_check
  check (tipo in ('recarga', 'compra', 'assinatura', 'apelido', 'ajuste', 'estorno'));
revoke all on table public.apelidos_da_chave from public, anon, authenticated;
grant select, insert, update on table public.apelidos_da_chave to service_role;

-- p_preco: o que a troca custa (a rota manda; o jogo nunca). Sem apelido ainda: grava de graça. O mesmo apelido de agora:
-- nada muda e nada é cobrado. Saldo travado (for update), nunca negativo.
create or replace function public.definir_apelido(p_chave uuid, p_apelido text, p_preco integer)
returns table (ok boolean, erro text, saldo integer, apelido text, cobrou integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_atual text; v_saldo integer;
begin
  if p_apelido is null or length(trim(p_apelido)) = 0 then
    return query select false, 'Apelido inválido.'::text, null::integer, null::text, 0; return;
  end if;
  insert into cupons_saldo (chave_id) values (p_chave) on conflict (chave_id) do nothing;
  select s.saldo into v_saldo from cupons_saldo s where s.chave_id = p_chave for update;
  select a.apelido into v_atual from apelidos_da_chave a where a.chave_id = p_chave for update;

  if v_atual is null then
    insert into apelidos_da_chave (chave_id, apelido) values (p_chave, p_apelido)
      on conflict (chave_id) do nothing;
    return query select true, null::text, v_saldo, p_apelido, 0; return;
  end if;
  if v_atual = p_apelido then
    return query select true, null::text, v_saldo, v_atual, 0; return;
  end if;
  if v_saldo < p_preco then
    return query select false, 'Cupons insuficientes.'::text, v_saldo, v_atual, 0; return;
  end if;

  update cupons_saldo set saldo = cupons_saldo.saldo - p_preco, atualizado_em = now()
    where cupons_saldo.chave_id = p_chave returning cupons_saldo.saldo into v_saldo;
  update apelidos_da_chave set apelido = p_apelido, trocas = apelidos_da_chave.trocas + 1, trocado_em = now()
    where apelidos_da_chave.chave_id = p_chave;
  insert into cupons_movimentos (chave_id, tipo, cupons, observacao)
    values (p_chave, 'apelido', -p_preco, v_atual || ' -> ' || p_apelido);
  return query select true, null::text, v_saldo, p_apelido, p_preco;
end $$;

revoke all on function public.definir_apelido(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.definir_apelido(uuid, text, integer) to service_role;
