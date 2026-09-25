// Limite de requisições simples, guardado no próprio Supabase (uma linha por chave).
// Barra laço automatizado sem depender de serviço externo.
// Regra de ouro: se o próprio limitador falhar, NÃO trava a venda (devolve permitido).
import { supabase } from "./supabase.js";

export async function limitar(chave, limite, janelaSegundos) {
  try {
    const sb = supabase();
    const agora = new Date();
    const { data } = await sb.from("rate_limit").select("*").eq("chave", chave).maybeSingle();

    if (!data || (agora - new Date(data.janela_em)) / 1000 > janelaSegundos) {
      await sb.from("rate_limit").upsert({ chave, contador: 1, janela_em: agora.toISOString() });
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
