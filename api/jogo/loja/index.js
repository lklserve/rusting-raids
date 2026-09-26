// POST /api/jogo/loja  { codigo, deviceId }  ->  { ok, cupons, itens:[{id, categoria, nome, preco}], meus:[id], pacotes:[...] }
// A loja de skins do jogo. Autentica como o /validar; resultados lógicos sempre com HTTP 200.
import { cabecalhos, ipDe } from "../../_lib/http.js";
import { supabase } from "../../_lib/supabase.js";
import { limitar } from "../../_lib/rate-limit.js";
import { autenticarJogador, estadoDaLoja } from "../../_lib/jogador.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`loja:ip:${ipDe(req)}`, 120, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const sb = supabase();
    const auth = await autenticarJogador(sb, req.body || {});
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);
    return res.status(200).json({ ok: true, ...(await estadoDaLoja(sb, auth.chave.id)) });
  } catch (e) {
    console.error("jogo/loja", e);
    return res.status(500).json({ ok: false, erro: "Erro ao abrir a loja." });
  }
}
