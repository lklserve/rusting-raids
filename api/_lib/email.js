// A chave por E-MAIL (12/10: "muitos clientes estão finalizando o pagamento mas não estão recebendo as suas chaves").
// Vai na hora em que a chave é emitida (emitir.js) e de novo quando o apoiador pede em "Não achou sua chave?"
// (POST /api/pix/status). SMTP comum pelo nodemailer: serve a senha de app de uma conta Gmail, o Brevo etc.
//
// Ambiente: SMTP_HOST, SMTP_PORT (465 = TLS direto; 587 = STARTTLS), SMTP_USER, SMTP_PASS e, opcional, EMAIL_DE
// ("Rusting Raids <conta@gmail.com>"). Sem eles o site só não manda e-mail: a chave continua na tela.
import nodemailer from "nodemailer";

const SITE = process.env.SITE_URL || "https://rusting-raids.vercel.app";

export const emailConfigurado = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporte;
function transportador() {
  if (!transporte) {
    const porta = Number(process.env.SMTP_PORT || 465);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // A função da Vercel não pode ficar presa num servidor de e-mail lento: o webhook e a tela esperam.
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 8000,
    });
  }
  return transporte;
}

const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// chaves: [{ codigo, status }]. novo = acabou de pagar; motivo "reenvio" = o reenvio a todos os apoiadores de 12/10 (o
// texto explica por que chegou); sem os dois, é o "Não achou sua chave?" que o próprio apoiador pediu.
export function montarEmail(chaves, { novo, motivo } = {}) {
  const ativas = chaves.filter((c) => c.status !== "banida");
  const uma = ativas.length === 1;
  const assunto = uma
    ? `Sua chave do Rusting Raids: ${ativas[0].codigo}`
    : `Suas ${ativas.length} chaves do Rusting Raids`;
  const abertura = novo
    ? "Pagamento confirmado! Valeu por apoiar o Rusting Raids."
    : motivo === "reenvio"
      ? `Estamos reenviando ${uma ? "a sua chave" : "as suas chaves"} do Rusting Raids para não se perder: alguns apoiadores pagaram o Pix e não viram a chave na tela. Se foi o seu caso, aqui está. Valeu pelo apoio!`
      : "Você pediu para reenviar as chaves deste e-mail.";
  const texto = [
    abertura,
    "",
    uma ? "A sua chave de acesso:" : "As suas chaves de acesso:",
    ...ativas.map((c) => `    ${c.codigo}`),
    "",
    "Como usar:",
    "1. Baixe e instale o jogo: " + SITE + "/#como-jogar",
    "2. Abra o Rusting Raids e toque em começar.",
    "3. No painel de chaves, cole a chave e confirme.",
    "",
    "Cada chave vale em até 3 aparelhos. Guarde este e-mail.",
    "Dúvidas? Responda este e-mail ou chame no Discord.",
  ].join("\n");
  const blocos = ativas.map((c) => `
      <tr><td style="padding:6px 0">
        <div style="font-family:Consolas,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:3px;color:#1f9d2b;
                    background:#f3fbf3;border:2px dashed #5fe06a;padding:14px 18px;text-align:center">${escapar(c.codigo)}</div>
      </td></tr>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f2f2f4;font-family:Arial,Helvetica,sans-serif;color:#1b1b20">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2f4;padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-top:6px solid #d6231c">
      <tr><td style="padding:24px 24px 8px">
        <div style="font-size:26px;font-weight:700;letter-spacing:1px">RUSTING RAIDS</div>
        <p style="font-size:16px;line-height:1.5;margin:14px 0 4px">${escapar(abertura)}</p>
        <p style="font-size:16px;line-height:1.5;margin:0 0 10px">${uma ? "A sua chave de acesso:" : "As suas chaves de acesso:"}</p>
      </td></tr>
      <tr><td style="padding:0 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${blocos}</table></td></tr>
      <tr><td style="padding:16px 24px 8px;font-size:15px;line-height:1.6">
        <b>Como usar</b><br>
        1. Baixe e instale o jogo pelo site.<br>
        2. Abra o Rusting Raids e toque em começar.<br>
        3. No <b>painel de chaves</b>, cole a chave e confirme.
      </td></tr>
      <tr><td style="padding:12px 24px 24px">
        <a href="${SITE}/#como-jogar" style="display:inline-block;background:#d6231c;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px">Baixar o jogo</a>
        <p style="font-size:13px;color:#555a62;line-height:1.5;margin:16px 0 0">Cada chave vale em até 3 aparelhos. Guarde este e-mail.<br>Dúvidas? Responda este e-mail ou chame no Discord.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  return { assunto, texto, html };
}

// -> true se o servidor de e-mail aceitou. Não lança (quem chama segue com a chave na tela), a não ser com lancarErro:
// o reenvio em lote precisa do código do Gmail para parar no primeiro sinal de limite.
export async function enviarChaves(para, chaves, { novo, motivo, lancarErro } = {}) {
  if (!emailConfigurado() || !para || !chaves?.some((c) => c.status !== "banida")) return false;
  const { assunto, texto, html } = montarEmail(chaves, { novo, motivo });
  try {
    await transportador().sendMail({
      from: process.env.EMAIL_DE || `Rusting Raids <${process.env.SMTP_USER}>`,
      to: para,
      subject: assunto,
      text: texto,
      html,
    });
    return true;
  } catch (e) {
    console.error("email: falha ao enviar", e?.code || "", e?.message || e);
    if (lancarErro) throw e;
    return false;
  }
}
