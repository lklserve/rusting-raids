// GET /api/meta -> { arrecadado }  Soma do mês (horário de Brasília) para a barra de meta do site.
// É público: devolve SÓ o número, nada de e-mail, chave ou pedido.
// A barra recomeça do zero em ZERADA_EM (13/10, pedido do Ronni: "zere a contagem de apoio"): soma os Pix pagos desde o
// mais novo entre essa hora e o começo do mês. O banco não muda; o painel continua com o total de verdade do mês.
// Proteção do banco: a CDN guarda a resposta 60 s, e cada instância da função guarda o valor
// 30 s na memória (assim nem uma enxurrada de URLs diferentes chega ao banco).
import { supabase } from "./_lib/supabase.js";

const ZERADA_EM = Date.parse("2026-10-13T21:10:00-03:00");
const POR_PAGINA = 1000;   // o teto de linhas por resposta do Supabase

let guardado = { em: 0, valor: null };
const VALIDADE_MS = 30 * 1000;

// 00:00 do dia 1 em São Paulo (UTC−3; sem horário de verão desde 2019), como o arrecadado_no_mes do painel_resumo.
function comecoDoMes(agora) {
  const sp = new Date(agora - 3 * 3600 * 1000);
  return Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), 1, 3);
}

// Soma em centavos, para 0,1 + 0,2 não virar 0,30000000000000004.
async function somarDesde(desde) {
  let centavos = 0;
  for (let de = 0; ; de += POR_PAGINA) {
    const { data, error } = await supabase().from("pedidos").select("valor")
      .eq("status", "aprovado").gte("aprovado_em", new Date(desde).toISOString())
      .order("id").range(de, de + POR_PAGINA - 1);
    if (error) throw error;
    for (const p of data || []) centavos += Math.round(Number(p.valor) * 100) || 0;
    if (!data || data.length < POR_PAGINA) return centavos / 100;
  }
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") return res.status(405).json({ erro: "Método não permitido" });

  try {
    if (guardado.valor === null || Date.now() - guardado.em > VALIDADE_MS) {
      const agora = Date.now();
      guardado = { em: agora, valor: await somarDesde(Math.max(comecoDoMes(agora), ZERADA_EM)) };
    }
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ arrecadado: guardado.valor });
  } catch (e) {
    console.error("meta", e);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ erro: "indisponível" });
  }
}
