-- =====================================================================================
-- Rusting Raids — OS PACOTES NA ESCADA DA RECARGA LIVRE (2026-10-29)
-- Pedido do Ronni: "uma opção de estar fazendo recarga de outros valores ... ele faz o cálculo exato de cada cupom ...
-- quanto maior for a recarga, mais porcentagem de cupom ele vai alcançar. O máximo é 80%". Escolhas dele: o bônus sobe
-- em linha reta de 5% (R$ 5) a 80% (R$ 500), e os pacotes seguem a mesma tabela (nunca dão menos que digitar o valor).
--
-- O valor livre não muda o banco: o pedido grava os cupons (pacote_id 'livre') e o creditar_recarga credita pelo pedido.
-- Aqui só o bônus dos pacotes, com a MESMA conta inteira do api/_lib/recarga.js (bonusDaRecarga):
--   bônus = floor(reais × 20 × (5 × 495 + 75 × (reais − 5)) / (100 × 495))
-- p5 = 5, p10 = 11, p15 = 19, p30 = 52, p75 = 234, p150 = 809. Os cupons-base (20 por real) não mudam.
-- Pedido já criado continua com os cupons de quando foi criado. Pode rodar de novo.
-- =====================================================================================

update public.loja_pacotes
   set bonus = floor(reais * 20 * (5 * 495 + 75 * (reais - 5)) / (100 * 495))::integer
 where reais between 5 and 500;
