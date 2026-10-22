// POST /api/jogo/loja/magnatas  { codigo, deviceId }
//   -> { ok: true, lista: [{ pos, nome, cupons }], eu: { pos, cupons } | null, total, atualizado }
// OS MAGNATAS (pedido do Ronni, 22/10: "um sistema de rank de quem mais gastou em conta, mais fez recarga, um botão no
// lobby que mostre esse rank dos jogadores mais magnatas do jogo"): as chaves que mais recarregaram cupons.
// - Conta as recargas APROVADAS, pelo valor pago: 20 cupons por R$ 1. O bônus dos pacotes e o dobro da primeira recarga
//   não contam, para o ranking ser de quem pagou mais.
// - Ficam de fora as chaves banidas e as de teste (observação "CHAVE DE TESTE").
// - O nome é o apelido da chave (o Cartão de Renomear); sem apelido, o último nome que um aparelho dela mandou; sem nenhum,
//   "Sobrevivente". O código da chave nunca sai daqui.
// - Os TAMANHO_DA_LISTA primeiros; "eu" é a posição de quem pediu, mesmo fora da lista (nulo sem nenhuma recarga).
// A conta inteira fica guardada GUARDAR_MS na memória da função: a lista não muda a cada segundo.
import { cabecalhos, ipDe } from "../http.js";
import { supabase } from "../supabase.js";
import { limitar } from "../rate-limit.js";
import { autenticarJogador } from "../jogador.js";

export const TAMANHO_DA_LISTA = 50;
export const CUPONS_POR_REAL = 20;
const GUARDAR_MS = 60 * 1000;
const PAGINA = 1000;
let guardado = null;   // { em, ranking: [{ chaveId, nome, cupons }] }

// Todas as linhas de uma consulta, em páginas de 1.000 (o Supabase devolve no máximo 1.000).
async function tudo(consulta) {
  const linhas = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta().range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

export async function calcularRanking(sb) {
  const [pedidos, chaves, apelidos, jogadores] = await Promise.all([
    tudo(() => sb.from("pedidos").select("recarga_chave_id, valor").eq("tipo", "recarga").eq("status", "aprovado").order("id")),
    tudo(() => sb.from("chaves").select("id, status, observacao").order("id")),
    tudo(() => sb.from("apelidos_da_chave").select("chave_id, apelido").order("chave_id")),
    tudo(() => sb.from("jogadores").select("chave_id, nome, ultimo_acesso").order("id")),
  ]);
  const fora = new Set(chaves.filter((c) => c.status === "banida" || /CHAVE DE TESTE/i.test(c.observacao || "")).map((c) => c.id));
  const soma = new Map();
  for (const p of pedidos) {
    if (!p.recarga_chave_id || fora.has(p.recarga_chave_id)) continue;
    soma.set(p.recarga_chave_id, (soma.get(p.recarga_chave_id) || 0) + Math.round(Number(p.valor) * CUPONS_POR_REAL));
  }
  const apelido = new Map(apelidos.map((a) => [a.chave_id, a.apelido]));
  const ultimoNome = new Map();
  for (const j of jogadores) {
    if (!j.nome) continue;
    const antes = ultimoNome.get(j.chave_id);
    if (!antes || String(j.ultimo_acesso || "") > String(antes.em || "")) ultimoNome.set(j.chave_id, { nome: j.nome, em: j.ultimo_acesso });
  }
  return [...soma.entries()]
    .map(([chaveId, cupons]) => ({ chaveId, cupons, nome: apelido.get(chaveId) || ultimoNome.get(chaveId)?.nome || "Sobrevivente" }))
    .sort((a, b) => b.cupons - a.cupons || String(a.chaveId).localeCompare(String(b.chaveId)));
}

export function esquecerRanking() { guardado = null; }

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`magnatas:ip:${ipDe(req)}`, 30, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });
  try {
    const sb = supabase();
    const auth = await autenticarJogador(sb, req.body || {});
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);
    if (!guardado || Date.now() - guardado.em > GUARDAR_MS) guardado = { em: Date.now(), ranking: await calcularRanking(sb) };
    const ranking = guardado.ranking;
    const minha = ranking.findIndex((r) => r.chaveId === auth.chave.id);
    return res.status(200).json({
      ok: true,
      lista: ranking.slice(0, TAMANHO_DA_LISTA).map((r, i) => ({ pos: i + 1, nome: r.nome, cupons: r.cupons, eu: r.chaveId === auth.chave.id })),
      eu: minha >= 0 ? { pos: minha + 1, cupons: ranking[minha].cupons } : null,
      total: ranking.length,
      atualizado: new Date(guardado.em).toISOString(),
    });
  } catch (e) {
    console.error("jogo/loja/magnatas", e);
    return res.status(500).json({ ok: false, erro: "Erro ao carregar os magnatas." });
  }
}
