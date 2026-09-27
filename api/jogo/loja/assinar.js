// POST /api/jogo/loja/assinar  { codigo, deviceId, planoId, compraId }   (contrato farm_automatico §2.2)
//   -> { ok: true, cupons, farm_ate, agora, repetida }
//   -> { ok: false, erro: "Cupons insuficientes." | "Plano indisponível." | "Prazo máximo atingido." | "Compra repetida com outro plano.",
//        cupons, farm_ate, agora }
// A Coleta Automática comprada em cupons. Preço e dias saem SÓ da tabela loja_planos; a função assinar_plano trava o
// saldo da chave, soma o prazo (max(fim, agora) + dias, até 90 dias) e é idempotente pelo compraId (o jogo reenvia a
// mesma compra se a resposta se perder, e o site não cobra de novo: repetida = true).
import { cabecalhos, ipDe } from "../../_lib/http.js";
import { supabase } from "../../_lib/supabase.js";
import { limitar } from "../../_lib/rate-limit.js";
import { autenticarJogador, isoZ } from "../../_lib/jogador.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`assinar:ip:${ipDe(req)}`, 60, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const corpo = req.body || {};
    const planoId = typeof corpo.planoId === "string" ? corpo.planoId.trim() : "";
    const compraId = typeof corpo.compraId === "string" ? corpo.compraId.trim() : "";
    if (planoId.length < 1 || planoId.length > 32 || !UUID.test(compraId))
      return res.status(400).json({ ok: false, erro: "Dados inválidos." });

    const sb = supabase();
    const auth = await autenticarJogador(sb, corpo);
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);
    // A mesma chave de limite da compra de skin: as duas somam.
    if (!(await limitar(`comprar:chave:${auth.chave.id}`, 30, 600)))
      return res.status(429).json({ ok: false, erro: "Muitas compras seguidas. Espere um pouco." });

    const { data, error } = await sb.rpc("assinar_plano", { p_chave: auth.chave.id, p_plano: planoId, p_compra: compraId.toLowerCase() });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    const prazo = { farm_ate: r?.ate ? isoZ(r.ate) : "", agora: isoZ(Date.now()) };
    if (!r?.ok) return res.status(200).json({ ok: false, erro: r?.erro || "Não foi possível assinar.", cupons: r?.saldo ?? 0, ...prazo });
    return res.status(200).json({ ok: true, cupons: r.saldo, ...prazo, repetida: !!r.repetida });
  } catch (e) {
    console.error("jogo/loja/assinar", e);
    return res.status(500).json({ ok: false, erro: "Erro ao assinar." });
  }
}
