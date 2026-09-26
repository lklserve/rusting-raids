// GET /api/meta -> { arrecadado }  Soma do mês (horário de Brasília) para a barra de meta do site.
// É público: devolve SÓ o número, nada de e-mail, chave ou pedido.
// Proteção do banco: a CDN guarda a resposta 60 s, e cada instância da função guarda o valor
// 30 s na memória (assim nem uma enxurrada de URLs diferentes chega ao banco).
import { supabase } from "./_lib/supabase.js";

let guardado = { em: 0, valor: null };
const VALIDADE_MS = 30 * 1000;

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  try {
    if (guardado.valor === null || Date.now() - guardado.em > VALIDADE_MS) {
      const { data, error } = await supabase().from("painel_resumo").select("arrecadado_no_mes").maybeSingle();
      if (error) throw error;
      guardado = { em: Date.now(), valor: Number(data?.arrecadado_no_mes || 0) };
    }
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ arrecadado: guardado.valor });
  } catch (e) {
    console.error("meta", e);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ erro: "indisponível" });
  }
}
