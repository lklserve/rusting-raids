// "Não achou sua chave?" — POST /api/pix/status { acao: "recuperar", email }  ->  { ok, mensagem }
// Manda para o e-mail TODAS as chaves compradas com ele. A resposta é a mesma com e sem chave (ninguém descobre se um
// e-mail comprou), e as chaves só vão para a caixa do próprio e-mail: quem digita o e-mail de outro não vê nada.
// Mora na função do status (api/pix/status.js) porque a Vercel Hobby conta 12 funções e o site está no teto.
import { ipDe, emailValido } from "./http.js";
import { supabase } from "./supabase.js";
import { limitar } from "./rate-limit.js";
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
