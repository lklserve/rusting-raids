-- O PACOTE DE R$ 5 (Ronni, 22/10: "adicione recarga de 5 reais no site"): 100 cupons (20 por real, como os outros), sem
-- bônus; com a recarga em dobro, 200. Vem primeiro na /recarga (ordem -1, antes do p10). Pode rodar de novo.
insert into public.loja_pacotes (id, reais, cupons, bonus, ativo, ordem) values ('p5', 5, 100, 0, true, -1)
  on conflict (id) do update set reais = excluded.reais, cupons = excluded.cupons, bonus = excluded.bonus,
                                 ativo = excluded.ativo, ordem = excluded.ordem;
