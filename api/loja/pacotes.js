// GET /api/loja/pacotes  ->  { pacotes: [{ id, reais, cupons, bonus }] }
// Os pacotes de recarga à venda (para a página /recarga). Público: não há nada de ninguém aqui.
import { cabecalhos } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  try {
    const { data, error } = await supabase().from("loja_pacotes").select("id, reais, cupons, bonus").eq("ativo", true).order("ordem");
    if (error) throw error;
    return res.status(200).json({ pacotes: (data || []).map((p) => ({ id: p.id, reais: Number(p.reais), cupons: p.cupons, bonus: p.bonus })) });
  } catch (e) {
    console.error("loja/pacotes", e);
    return res.status(500).json({ erro: "indisponível" });
  }
}
