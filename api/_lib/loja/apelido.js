// POST /api/jogo/loja/apelido  { codigo, deviceId, nome }
//   -> { ok: true, cupons, apelido, cobrou }  ou  { ok: false, erro, cupons, apelido }
// O Cartão de Renomear (supabase/apelido.sql): o primeiro apelido da chave é de graça; trocar custa PRECO_DO_APELIDO
// cupons. O preço sai SÓ daqui; a função definir_apelido trava o saldo e não deixa ficar negativo.
import { cabecalhos, ipDe } from "../http.js";
import { supabase } from "../supabase.js";
import { limitar } from "../rate-limit.js";
import { autenticarJogador } from "../jogador.js";
import { PRECO_DO_APELIDO, validarApelido, apelidoDaChave } from "../apelido.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`apelido:ip:${ipDe(req)}`, 30, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const corpo = req.body || {};
    const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
    const recusa = validarApelido(nome);
    if (recusa) return res.status(200).json({ ok: false, erro: recusa });

    const sb = supabase();
    const auth = await autenticarJogador(sb, corpo);
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);
    if (!(await limitar(`apelido:chave:${auth.chave.id}`, 10, 600)))
      return res.status(429).json({ ok: false, erro: "Muitas trocas seguidas. Espere um pouco." });

    const { data, error } = await sb.rpc("definir_apelido", { p_chave: auth.chave.id, p_apelido: nome, p_preco: PRECO_DO_APELIDO });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.ok)
      return res.status(200).json({ ok: false, erro: r?.erro || "Não foi possível trocar o apelido.", cupons: r?.saldo ?? 0,
                                    apelido: r?.apelido || (await apelidoDaChave(sb, auth.chave.id)) });
    return res.status(200).json({ ok: true, cupons: r.saldo ?? 0, apelido: r.apelido || nome, cobrou: r.cobrou || 0 });
  } catch (e) {
    console.error("jogo/loja/apelido", e);
    return res.status(500).json({ ok: false, erro: "Erro ao trocar o apelido." });
  }
}
