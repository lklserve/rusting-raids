// O BILHETE de entrada no servidor do jogo (M7, _Placeholder/servidor_m7/PLANO.md §1): o site assina quem é o
// jogador, e o servidor da VPS confere com a chave PÚBLICA embutida (Game.Core/Servidor/BilheteDoSite.cs), sem
// chamar o site a cada entrada.
//
// Formato: base64url(JSON da carga) + "." + base64url(assinatura RSA-2048, SHA-256, PKCS#1 v1.5 dos bytes ASCII da
// primeira parte). Carga: { v, jogador, chave, disp, adm, farm_ate, iat, exp } — iat/exp em segundos Unix (UTC);
// adm = a chave é ADM do jogo (painel de chaves), para o servidor aceitar os comandos de ADM só dela.
// A chave PRIVADA mora só na variável de ambiente BILHETE_CHAVE_PRIVADA da Vercel (PEM PKCS#8).
import { createHash, createPrivateKey, sign } from "node:crypto";

export const VERSAO_DO_BILHETE = 1;
export const VALIDADE_DO_BILHETE = 600; // 10 min: só para entrar; quem já está dentro não é tirado no vencimento.

let _chave = null;
function chavePrivada() {
  if (_chave) return _chave;
  const pem = process.env.BILHETE_CHAVE_PRIVADA;
  if (!pem) return null;
  // Aceita o PEM com quebras de linha de verdade ou com "\n" escrito.
  _chave = createPrivateKey(pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem);
  return _chave;
}

export const bilheteDisponivel = () => !!process.env.BILHETE_CHAVE_PRIVADA;

const b64url = (buf) => Buffer.from(buf).toString("base64url");

// O aparelho vai resumido (não é segredo, mas o deviceId inteiro não precisa sair do site).
export const resumoDoAparelho = (deviceId) => createHash("sha256").update(deviceId, "utf8").digest("hex").slice(0, 16);

// -> { bilhete, exp (segundos Unix) }
export function emitirBilhete({ jogadorId, chaveId, deviceId, adm, farmAte }) {
  const chave = chavePrivada();
  if (!chave) throw new Error("BILHETE_CHAVE_PRIVADA ausente");
  const iat = Math.floor(Date.now() / 1000);
  const carga = {
    v: VERSAO_DO_BILHETE,
    jogador: String(jogadorId).toLowerCase(),
    chave: String(chaveId).toLowerCase(),
    disp: resumoDoAparelho(deviceId),
    adm: !!adm,
    farm_ate: farmAte || "",
    iat,
    exp: iat + VALIDADE_DO_BILHETE,
  };
  const parte = b64url(JSON.stringify(carga));
  const assinatura = sign("sha256", Buffer.from(parte, "ascii"), chave); // RSA PKCS#1 v1.5
  return { bilhete: `${parte}.${b64url(assinatura)}`, exp: carga.exp };
}
