// Cliente do Supabase para as funções da Vercel. Usa a SERVICE ROLE — que só existe
// no servidor, NUNCA no navegador. O banco fica trancado por RLS; só isto acessa.
import { createClient } from "@supabase/supabase-js";

let cliente;

export function supabase() {
  if (!cliente) {
    const url = process.env.SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente");
    cliente = createClient(url, chave, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-rr": "servidor" } },
    });
  }
  return cliente;
}
