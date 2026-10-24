-- =====================================================================================================================
-- Rusting Raids — CONFORMIDADE (24/10, jogo-c6): a prova do aceite dos Termos e os prazos de guarda da Política de
-- Privacidade (privacidade.html, seção 7).
--
-- 1) pedidos.termos_versao / termos_aceitos_em: a versão dos Termos que o comprador marcou antes do Pix (o value da caixa
--    de aceite) e a hora. As rotas /api/pix/criar e /api/pix/recarga já mandam; sem estas colunas o pedido entra sem
--    elas (api/_lib/pedido.js).
-- 2) limpar_dados_vencidos(): apaga o que a Política promete apagar. Rodar uma vez por dia (pg_cron, no fim do arquivo).
--    - Pix não pagos (pendente/expirado/cancelado) que não viraram chave nem cupom: 90 dias;
--    - o QR e o copia-e-cola do Pix: 2 dias (só servem enquanto o Pix pode ser pago, que é 30 min);
--    - o limite de tentativas (rate_limit): 1 dia (a rota também faxina de vez em quando).
--
-- Rodar UMA vez no SQL Editor do Supabase (projeto do jogo). Pode rodar de novo. NÃO roda sozinho: o Ronni manda.
-- =====================================================================================================================
begin;

alter table public.pedidos add column if not exists termos_versao text;
alter table public.pedidos add column if not exists termos_aceitos_em timestamptz;

create or replace function public.limpar_dados_vencidos()
returns json
language plpgsql security definer set search_path = public as $$
declare v_pedidos int; v_qr int; v_limites int;
begin
  delete from pedidos p
   where p.status <> 'aprovado'
     and p.chave_id is null
     and p.criado_em < now() - interval '90 days'
     and not exists (select 1 from chaves c where c.pedido_id = p.id)
     and not exists (select 1 from cupons_movimentos m where m.pedido_id = p.id);
  get diagnostics v_pedidos = row_count;

  update pedidos set pix_qr_base64 = null, pix_copia_cola = null
   where (pix_qr_base64 is not null or pix_copia_cola is not null)
     and criado_em < now() - interval '2 days';
  get diagnostics v_qr = row_count;

  delete from rate_limit where janela_em < now() - interval '1 day';
  get diagnostics v_limites = row_count;

  return json_build_object('pedidos_apagados', v_pedidos, 'qr_apagados', v_qr, 'limites_apagados', v_limites);
end $$;

revoke all on function public.limpar_dados_vencidos() from public, anon, authenticated;
grant execute on function public.limpar_dados_vencidos() to service_role;

commit;

-- Primeira faxina na hora (mostra quanto apagou):
--   select public.limpar_dados_vencidos();
--
-- Todo dia às 04:17 UTC, pelo pg_cron (Supabase: Database → Extensions → pg_cron ligado):
--   select cron.schedule('rr-limpar-dados-vencidos', '17 4 * * *', $$select public.limpar_dados_vencidos()$$);
-- Conferir: select * from cron.job;   ·   Tirar: select cron.unschedule('rr-limpar-dados-vencidos');
