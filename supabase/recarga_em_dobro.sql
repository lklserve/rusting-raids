-- A PRIMEIRA RECARGA EM DOBRO (pedido do Ronni, 21/10: "quando um player faz uma recarga ele ganha o dobro, mas isso só
-- funciona uma vez").
--
-- A primeira recarga APROVADA de cada chave credita o dobro do pacote (cupons + bônus, × 2). As seguintes creditam o
-- pacote normal. "Primeira" = a chave não tem nenhuma recarga no livro-caixa (as chaves que já recarregaram antes deste
-- arquivo NÃO ganham). Vale por chave: é a chave que recebe os cupons.
--
-- O dobro é decidido AQUI, na hora do crédito, e não na hora do Pix: duas recargas da mesma chave pagas juntas não
-- ganham o dobro duas vezes (o saldo da chave fica travado com "for update" enquanto se confere). O pedido continua com
-- os cupons do pacote; o livro-caixa guarda o que entrou, com a observação "primeira recarga em dobro".
-- Mesma assinatura e mesmo retorno de antes (creditou, cupons, saldo): "cupons" passa a ser o que ENTROU na chave.
-- Idempotente pelo pedido_id único do livro-caixa: processar o mesmo pedido de novo não credita nada.
-- Rodar UMA vez no SQL Editor do Supabase, depois do loja.sql (pode rodar de novo).

create or replace function public.creditar_recarga(p_pedido uuid)
returns table (creditou boolean, cupons integer, saldo integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_chave uuid; v_cupons integer; v_saldo integer; v_mov bigint; v_ja integer; v_credito integer; v_primeira boolean;
begin
  select p.recarga_chave_id, p.cupons into v_chave, v_cupons
    from pedidos p where p.id = p_pedido and p.tipo = 'recarga' for update;
  if v_chave is null or v_cupons is null then raise exception 'pedido de recarga inválido'; end if;
  insert into cupons_saldo (chave_id) values (v_chave) on conflict (chave_id) do nothing;
  -- Uma recarga por vez nesta chave: quem chegar depois espera e já vê a primeira no livro-caixa.
  select s.saldo into v_saldo from cupons_saldo s where s.chave_id = v_chave for update;

  -- Já creditado (webhook e consulta da tela chegam juntos): devolve o que entrou da primeira vez.
  select m.cupons into v_ja from cupons_movimentos m where m.pedido_id = p_pedido;
  if v_ja is not null then
    update pedidos set status = 'aprovado', aprovado_em = coalesce(aprovado_em, now())
      where id = p_pedido and status <> 'aprovado';
    return query select false, v_ja, v_saldo; return;
  end if;

  v_primeira := not exists (select 1 from cupons_movimentos m where m.chave_id = v_chave and m.tipo = 'recarga');
  v_credito := case when v_primeira then v_cupons * 2 else v_cupons end;
  insert into cupons_movimentos (chave_id, tipo, cupons, pedido_id, observacao)
    values (v_chave, 'recarga', v_credito, p_pedido, case when v_primeira then 'primeira recarga em dobro' end)
    on conflict (pedido_id) do nothing returning id into v_mov;
  if v_mov is not null then
    update cupons_saldo set saldo = cupons_saldo.saldo + v_credito, atualizado_em = now()
      where cupons_saldo.chave_id = v_chave returning cupons_saldo.saldo into v_saldo;
  end if;
  update pedidos set status = 'aprovado', aprovado_em = coalesce(aprovado_em, now())
    where id = p_pedido and status <> 'aprovado';
  return query select (v_mov is not null), v_credito, v_saldo;
end $$;

revoke all on function public.creditar_recarga(uuid) from public, anon, authenticated;
grant execute on function public.creditar_recarga(uuid) to service_role;
