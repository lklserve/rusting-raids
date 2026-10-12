// "Não achou sua chave?" — POST /api/pix/status { acao: "recuperar", email }  ->  { ok, mensagem }
// Manda para o e-mail TODAS as chaves compradas com ele. A resposta é a mesma com e sem chave (ninguém descobre se um
// e-mail comprou), e as chaves só vão para a caixa do próprio e-mail: quem digita o e-mail de outro não vê nada.
// Mora na função do status (api/pix/status.js) porque a Vercel Hobby conta 12 funções e o site está no teto.
import { ipDe, emailValido } from "./http.js";
import { supabase } from "./supabase.js";
import { limitar } from "./rate-limit.js";
import { timingSafeEqual } from "node:crypto";
import { emailConfigurado, enviarChaves } from "./email.js";

const RESPOSTA = "Se este e-mail tiver chaves, elas chegam em alguns minutos. Olhe também a caixa de spam e a aba Promoções.";

export async function recuperarPorEmail(req, res) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!emailValido(email)) return res.status(400).json({ ok: false, erro: "Digite o e-mail que você usou no Pix." });
  if (!emailConfigurado())
    return res.status(503).json({ ok: false, erro: "O envio por e-mail ainda não está ligado. Chame a gente no Discord com o comprovante do Pix." });

  // Barra quem usaria isto para encher a caixa de alguém: poucas vezes por e-mail e por IP.
  const okEmail = await limitar(`recuperar:email:${email}`, 3, 3600);
  const okIp = await limitar(`recuperar:ip:${ipDe(req)}`, 10, 3600);
  if (!okEmail || !okIp) return res.status(429).json({ ok: false, erro: "Muitos pedidos seguidos. Espere uma hora e tente de novo." });

  try {
    const { data, error } = await supabase().from("chaves")
      .select("codigo, status, email, criado_em").eq("email", email).order("criado_em");
    if (error) throw error;
    // Igualdade exata (sem LIKE: o "_" de um e-mail não pode casar com outro endereço).
    const chaves = (data || []).filter((c) => String(c.email).toLowerCase() === email);
    if (chaves.length) await enviarChaves(email, chaves, { novo: false });
    return res.status(200).json({ ok: true, mensagem: RESPOSTA });
  } catch (e) {
    console.error("recuperar", e?.message || e);
    return res.status(500).json({ ok: false, erro: "Não consegui mandar agora. Tente de novo daqui a pouco." });
  }
}

// REENVIO EM LOTE (12/10, OK do Ronni: "pode mandar a chave para os apoiadores"): o script do administrador chama
// POST /api/pix/status { acao: "reenviar", email } com o cabeçalho x-rr-admin = ADMIN_ENVIO_SEGREDO, um e-mail por
// vez, no ritmo que o Gmail aguenta. Manda as chaves ATIVAS desse e-mail com o texto do reenvio. Sem a variável a
// ação não existe (503); com o segredo errado, 403. Mesmo com o segredo vazado, só reenvia a cada dono as chaves dele.
// -> { ok, enviado, chaves }  ·  502 { ok:false, erro, codigo } quando o Gmail recusa (o script para ali).
export async function reenviarParaUm(req, res) {
  const segredo = process.env.ADMIN_ENVIO_SEGREDO || "";
  if (segredo.length < 32) return res.status(503).json({ ok: false, erro: "Indisponível." });
  const dado = String(req.headers["x-rr-admin"] || "");
  const a = Buffer.from(dado), b = Buffer.from(segredo);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(403).json({ ok: false, erro: "Proibido." });
  if (!emailConfigurado()) return res.status(503).json({ ok: false, erro: "SMTP desligado." });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!emailValido(email)) return res.status(400).json({ ok: false, erro: "E-mail inválido." });
  const { data, error } = await supabase().from("chaves")
    .select("codigo, status, email, criado_em").eq("email", email).eq("status", "ativa").order("criado_em");
  if (error) return res.status(500).json({ ok: false, erro: "Banco." });
  const chaves = (data || []).filter((c) => String(c.email).toLowerCase() === email);
  if (!chaves.length) return res.status(200).json({ ok: true, enviado: false, chaves: 0 });
  try {
    const enviado = await enviarChaves(email, chaves, { motivo: "reenvio", lancarErro: true });
    return res.status(200).json({ ok: true, enviado, chaves: chaves.length });
  } catch (e) {
    return res.status(502).json({ ok: false, erro: String(e?.response || e?.message || "falha").slice(0, 200), codigo: e?.responseCode || e?.code || "" });
  }
}
