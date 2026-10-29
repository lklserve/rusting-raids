// GET /api/loja/pacotes[?chave=RR-XXXX-XXXX]  ->  { pacotes: [{ id, reais, cupons, bonus }], livre, emDobro }
// Os pacotes de recarga à venda (para a página /recarga). Com a chave, diz também se ela ainda tem a RECARGA EM
// DOBRO (supabase/recarga_em_dobro.sql): só um sim ou não, nada da conta. Sem chave (ou chave que não existe), emDobro
// é falso. "livre" = a faixa e a escada do bônus da recarga com valor livre (_lib/recarga.js), para a página fazer a
// mesma conta que o servidor.
import { cabecalhos, ipDe, normalizarCodigo } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { recargaEmDobro, RECARGA_LIVRE } from "../_lib/recarga.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });
  try {
    const sb = supabase();
    const { data, error } = await sb.from("loja_pacotes").select("id, reais, cupons, bonus").eq("ativo", true).order("ordem");
    if (error) throw error;
    let emDobro = false;
    const codigo = normalizarCodigo(req.query?.chave);
    if (codigo && await limitar(`pacotes:ip:${ipDe(req)}`, 60, 600)) {
      const { data: chave } = await sb.from("chaves").select("id, status").eq("codigo", codigo).maybeSingle();
      if (chave && chave.status !== "banida") emDobro = await recargaEmDobro(sb, chave.id);
    }
    return res.status(200).json({
      pacotes: (data || []).map((p) => ({ id: p.id, reais: Number(p.reais), cupons: p.cupons, bonus: p.bonus })),
      livre: RECARGA_LIVRE,
      emDobro,
    });
  } catch (e) {
    console.error("loja/pacotes", e);
    return res.status(500).json({ erro: "indisponível" });
  }
}
