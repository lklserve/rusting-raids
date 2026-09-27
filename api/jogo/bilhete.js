// POST /api/jogo/bilhete  { codigo, deviceId }  ->  { ok, bilhete, exp, agora }
// O jogo pede logo antes de conectar no servidor da VPS (M7). Autentica como o /validar (aparelho sem ban, chave
// ativa, aparelho ativado nela) e devolve o bilhete assinado (_lib/bilhete.js), que vale 10 min para ENTRAR.
// Resultados lógicos (ban, chave recusada) com HTTP 200, como as outras rotas do jogo.
import { cabecalhos, ipDe } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { autenticarJogador, prazoOuNada, isoZ } from "../_lib/jogador.js";
import { emitirBilhete, bilheteDisponivel } from "../_lib/bilhete.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`bilhete:ip:${ipDe(req)}`, 60, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });
  if (!bilheteDisponivel())
    return res.status(503).json({ ok: false, erro: "Entrada no servidor em manutenção." });

  try {
    const sb = supabase();
    const auth = await autenticarJogador(sb, req.body || {});
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);

    // Sem o prazo da coleta o bilhete sai do mesmo jeito (farm_ate vazio = coleta paga desligada no servidor).
    const { farm_ate } = await prazoOuNada(sb, auth.chave.id);
    const { bilhete, exp } = emitirBilhete({
      jogadorId: auth.jogadorId,
      chaveId: auth.chave.id,
      deviceId: String(req.body.deviceId).trim(),
      farmAte: farm_ate,
    });
    await sb.from("jogadores").update({ ultimo_acesso: new Date().toISOString() }).eq("id", auth.jogadorId);
    return res.status(200).json({ ok: true, bilhete, exp: isoZ(exp * 1000), agora: isoZ(Date.now()) });
  } catch (e) {
    console.error("jogo/bilhete", e?.message || e);
    return res.status(500).json({ ok: false, erro: "Erro ao emitir a entrada no servidor." });
  }
}
