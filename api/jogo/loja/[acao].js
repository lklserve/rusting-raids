// POST /api/jogo/loja/comprar e POST /api/jogo/loja/assinar numa função só: a Vercel Hobby conta 12 funções por deploy,
// e o site estava no teto quando entrou a conta Google (api/conta/[acao].js). As rotas, os contratos e o código de
// cada uma não mudaram — moram em api/_lib/loja/ (pasta com "_" não vira função).
import comprar from "../../_lib/loja/comprar.js";
import assinar from "../../_lib/loja/assinar.js";
import { cabecalhos, acaoDaRota } from "../../_lib/http.js";

const ROTAS = new Map([
  ["comprar", comprar],
  ["assinar", assinar],
]);

export default async function handler(req, res) {
  const rota = ROTAS.get(acaoDaRota(req));
  if (rota) return rota(req, res);
  if (cabecalhos(req, res)) return;
  return res.status(404).json({ ok: false, erro: "Rota não encontrada." });
}
