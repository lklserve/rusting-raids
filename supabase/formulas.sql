-- =====================================================================================
-- Rusting Raids — FÓRMULAS DE VEÍCULO NA LOJA (2026-10-10)
-- Pedido do Ronni: "Fórmulas de veículos a preço fixo de 1.000 Cupons cada, desbloqueando a fórmula após compra".
-- E a Mini Mineradora (58776) a 500 cupons: quem compra fabrica em qualquer servidor e põe até 4 por base (sem ela, 2).
-- O id é o da Fórmula do LIOS, que é o mesmo da receita (Game.Core/Loja/FormulasDaLoja.cs no jogo). A compra é a
-- mesma das skins (comprar_item); o que muda é a categoria 'formula' e que o BILHETE leva as fórmulas da chave
-- (api/jogo/bilhete.js), para o servidor da VPS ensinar a receita na entrada.
-- O APK de antes ignora a categoria (a vitrine só mostra o que o catálogo dele conhece). Rodar depois do loja.sql.
-- =====================================================================================

-- A categoria nova. A lista inclui 'personagem' (as skins de personagem de 2026-10-09) para não derrubá-la se ela já
-- estiver no banco.
alter table public.loja_itens drop constraint if exists loja_itens_categoria_check;
alter table public.loja_itens add constraint loja_itens_categoria_check
  check (categoria in ('arma', 'explosivo', 'veiculo', 'moldura', 'balao', 'personagem', 'formula'));

insert into public.loja_itens (id, categoria, nome, preco_cupons, ativo, ordem) values
  (57290, 'formula', 'Fórmula: Motocicleta',                       1000, true, 1),
  (57279, 'formula', 'Fórmula: Veículo blindado',                  1000, true, 2),
  (57280, 'formula', 'Fórmula: Veículo de Guerra Pesado',          1000, true, 3),
  (57291, 'formula', 'Fórmula: Tanque Destruidor',                 1000, true, 4),
  (57319, 'formula', 'Fórmula: Carrinho de Abóbora de Halloween',  1000, true, 5),
  (57288, 'formula', 'Fórmula: Helicóptero Leve',                  1000, true, 6),
  (57289, 'formula', 'Fórmula: Helicóptero de Xianglong',          1000, true, 7),
  (58776, 'formula', 'Fórmula: Mini Mineradora',                    500, true, 8)
on conflict (id) do update set categoria = excluded.categoria, nome = excluded.nome,
  preco_cupons = excluded.preco_cupons, ordem = excluded.ordem;
