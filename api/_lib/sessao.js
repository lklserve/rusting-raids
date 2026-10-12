// A SESSÃO da conta Google (rotas /api/auth/* e /api/player/progress): um JWT HS256 assinado com JWT_SECRET, que o
// jogo guarda cifrado (Game.Core/Licenca/ContaGoogle.cs) e manda em "Authorization: Bearer <token>".
//
// Carga: { iss, sub (id da conta), sv (contas.sessao_versao), disp (resumo do aparelho), iat, exp } — segundos Unix.
// O sv deixa o painel derrubar todas as sessões de uma conta (sobe a versão no banco); a conta e a chave ligada são
// conferidas no banco a cada pedido (conta_da_sessao), então ban e bloqueio valem na hora, não no vencimento.
// O cabeçalho é FIXO (só HS256): token com outro "alg" (inclusive "none") é recusado antes de olhar a assinatura.
import { createHmac, timingSafeEqual } from "node:crypto";

export const EMISSOR = "rusting-raids";
export const VALIDADE_DA_SESSAO = 30 * 24 * 3600; // 30 dias; o jogo entra de novo com o Google quando vence
const FOLGA_DO_RELOGIO = 120;

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const CABECALHO = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function segredo() {
  const s = process.env.JWT_SECRET || "";
  // 32 bytes no mínimo: o HMAC-SHA256 com segredo curto cai em força bruta offline.
  if (Buffer.byteLength(s, "utf8") < 32) throw new Error("JWT_SECRET ausente ou curto (mínimo 32 bytes)");
  return s;
}

export const sessaoDisponivel = () => Buffer.byteLength(process.env.JWT_SECRET || "", "utf8") >= 32;

const assinar = (texto) => createHmac("sha256", segredo()).update(texto, "ascii").digest();

// -> { sessao, exp }
export function emitirSessao({ contaId, sessaoVersao, disp }) {
  const iat = Math.floor(Date.now() / 1000);
  const carga = {
    iss: EMISSOR,
    sub: String(contaId).toLowerCase(),
    sv: Number(sessaoVersao) || 1,
    disp: disp || "",
    iat,
    exp: iat + VALIDADE_DA_SESSAO,
  };
  const corpo = `${CABECALHO}.${b64url(JSON.stringify(carga))}`;
  return { sessao: `${corpo}.${b64url(assinar(corpo))}`, exp: carga.exp };
}

// -> a carga, ou null (formato, assinatura, emissor ou prazo).
export function lerSessao(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== CABECALHO) return null;

  const esperada = assinar(`${partes[0]}.${partes[1]}`);
  let recebida;
  try { recebida = Buffer.from(partes[2], "base64url"); } catch { return null; }
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;

  let carga;
  try { carga = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8")); } catch { return null; }
  const agora = Math.floor(Date.now() / 1000);
  if (!carga || carga.iss !== EMISSOR || typeof carga.sub !== "string") return null;
  if (!Number.isInteger(carga.exp) || !Number.isInteger(carga.iat)) return null;
  if (carga.exp <= agora || carga.iat > agora + FOLGA_DO_RELOGIO) return null;
  return carga;
}

// O token do cabeçalho Authorization ("Bearer <token>"), ou "".
export function tokenDoPedido(req) {
  const h = req.headers?.authorization;
  if (typeof h !== "string") return "";
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : "";
}
