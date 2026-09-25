// Gera o código da chave de acesso.
// Gerador CRIPTOGRÁFICO (crypto), nunca Math.random(): uma chave adivinhável seria uma
// chave de graça. Alfabeto sem caracteres ambíguos (0/O, 1/I) para o jogador não errar.
import crypto from "node:crypto";

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos

export function gerarCodigo() {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (const b of bytes) s += ALFABETO[b & 0x1f];
  return `RR-${s.slice(0, 4)}-${s.slice(4, 8)}`;
}
