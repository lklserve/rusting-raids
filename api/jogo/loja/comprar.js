// POST /api/jogo/loja/comprar  { codigo, deviceId, itemId }
//   -> { ok: true, cupons, meus }  ou  { ok: false, erro: "Cupons insuficientes." | "Você já tem este item." | "Item indisponível.", cupons }
// O preço sai SÓ da tabela loja_itens; a função comprar_item trava o saldo e não deixa ficar negativo.
import { cabecalhos, ipDe } from "../../_lib/http.js";
import { supabase } from "../../_lib/supabase.js";
import { limitar } from "../../_lib/rate-limit.js";
import { autenticarJogador } from "../../_lib/jogador.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`comprar:ip:${ipDe(req)}`, 60, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const corpo = req.body || {};
    const itemId = Number(corpo.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0 || itemId > 2147483647)
      return res.status(400).json({ ok: false, erro: "Item inválido." });

    const sb = supabase();
    const auth = await autenticarJogador(sb, corpo);
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);
    if (!(await limitar(`comprar:chave:${auth.chave.id}`, 30, 600)))
      return res.status(429).json({ ok: false, erro: "Muitas compras seguidas. Espere um pouco." });

    const { data, error } = await sb.rpc("comprar_item", { p_chave: auth.chave.id, p_item: itemId });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.ok) return res.status(200).json({ ok: false, erro: r?.erro || "Não foi possível comprar.", cupons: r?.saldo ?? 0 });

    const { data: meus } = await sb.from("itens_da_chave").select("item_id").eq("chave_id", auth.chave.id);
    return res.status(200).json({ ok: true, cupons: r.saldo, meus: (meus || []).map((m) => m.item_id) });
  } catch (e) {
    console.error("jogo/loja/comprar", e);
    return res.status(500).json({ ok: false, erro: "Erro ao comprar." });
  }
}
