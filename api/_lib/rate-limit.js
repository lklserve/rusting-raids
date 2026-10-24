// Limite de requisições simples, guardado no próprio Supabase (uma linha por chave).
// Barra laço automatizado sem depender de serviço externo.
// Regra de ouro: se o próprio limitador falhar, NÃO trava a venda (devolve permitido).
//
// Privacidade (24/10): a chave chega como "<rota>:<tipo>:<identificador>" (ex.: "pix:ip:1.2.3.4", "pix:email:x@y.com").
// O identificador vai para o banco já cifrado (HMAC-SHA256 com um segredo do servidor), nunca o IP ou o e-mail em
// claro, e as linhas com mais de 1 dia são apagadas de vez em quando (a maior janela usada é de 1 hora).
import { createHmac } from "node:crypto";
import { supabase } from "./supabase.js";

const GUARDAR_MS = 24 * 3600 * 1000;

function segredo() {
  return process.env.RATE_LIMIT_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY || "rusting-raids";
}

export function resumirChave(chave) {
  const i = chave.indexOf(":", chave.indexOf(":") + 1);
  if (i < 0) return chave;
  return chave.slice(0, i + 1) + createHmac("sha256", segredo()).update(chave.slice(i + 1)).digest("hex").slice(0, 32);
}

async function faxinar(sb) {
  try {
    await sb.from("rate_limit").delete().lt("janela_em", new Date(Date.now() - GUARDAR_MS).toISOString());
  } catch (e) {
    console.error("rate-limit: faxina falhou:", e?.message);
  }
}

export async function limitar(chaveCrua, limite, janelaSegundos) {
  try {
    const sb = supabase();
    const chave = resumirChave(chaveCrua);
    const agora = new Date();
    const { data } = await sb.from("rate_limit").select("*").eq("chave", chave).maybeSingle();

    if (!data || (agora - new Date(data.janela_em)) / 1000 > janelaSegundos) {
      await sb.from("rate_limit").upsert({ chave, contador: 1, janela_em: agora.toISOString() });
      if (Math.random() < 0.02) await faxinar(sb);   // ~1 em 50 janelas novas
      return true;
    }
    if (data.contador >= limite) return false;
    await sb.from("rate_limit").update({ contador: data.contador + 1 }).eq("chave", chave);
    return true;
  } catch (e) {
    console.error("rate-limit falhou (liberando):", e?.message);
    return true;
  }
}
