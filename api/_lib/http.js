// Ajudantes de HTTP e segurança compartilhados pelas funções.

// Origem liberada para o navegador. Por padrão, o próprio site.
// Defina SITE_ORIGEM na Vercel (ex.: https://rusting-raids.vercel.app) para trancar.
export function cabecalhos(req, res) {
  const permitida = process.env.SITE_ORIGEM || "";
  const origem = req.headers.origin || "";
  if (!permitida || permitida === "*") {
    res.setHeader("Access-Control-Allow-Origin", origem || "*");
  } else if (origem === permitida) {
    res.setHeader("Access-Control-Allow-Origin", permitida);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-RR-App");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

// IP do cliente (a Vercel põe o real em x-forwarded-for).
export function ipDe(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "0.0.0.0";
}

export const emailValido = (s) =>
  typeof s === "string" && s.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

// Corta e valida um texto curto (device id, nome). Devolve "" se inválido.
export function texto(s, max) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return t.length === 0 || t.length > max ? "" : t;
}

// Código de chave no formato RR-XXXX-XXXX (aceita com ou sem hífens, maiúsculo).
export function normalizarCodigo(s) {
  if (typeof s !== "string") return "";
  const limpo = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (limpo.length !== 10 || !limpo.startsWith("RR")) return "";
  return `RR-${limpo.slice(2, 6)}-${limpo.slice(6, 10)}`;
}
