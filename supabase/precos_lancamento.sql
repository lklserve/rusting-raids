-- =====================================================================================
-- Rusting Raids — PREÇOS DO LANÇAMENTO ABERTO (2026-10-27)
-- Pedido do Ronni: "remova o desconto atual de 70% (que deixava as skins por cerca de R$ 15). Restaure o preço original
-- para o equivalente a R$ 50 em cupons para cada skin de arma evolutiva" e "ajuste o valor do Passe para custar
-- exatamente 388 cupons". 20 cupons = R$ 1 (loja.sql): R$ 50 = 1000 cupons.
--
-- Evolutiva = skin de arma com o quinto dígito do id igual a 6 (PPPP Q SSS V; o jogo usa a mesma regra em
-- SkinsDaLojaSO.EhEvolutiva). O passe é o 990001 (passe_avancado_990001.sql). Quem já comprou continua com o item.
-- Rodar no dia do lançamento, numa transação, conferindo as contagens antes.
-- =====================================================================================

update public.loja_itens
   set preco_cupons = 1000
 where categoria = 'arma'
   and (id / 10000) % 10 = 6;

update public.loja_itens
   set preco_cupons = 388
 where id = 990001;
