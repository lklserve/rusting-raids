// POST /api/jogo/loja/roleta  { codigo, deviceId, roleta, girar?, giroId? }
//   -> { ok: true, roleta, nome, inicio, fim, aberta, cupons, giros, precos, proximo_preco,
//        premios: [{ id, vaga, peso, nome, categoria, ganho }], meus,
//        (ao girar) ganhou, preco, repetida }
//   ou { ok: false, erro, cupons, ... o mesmo estado }
// A roleta sem repetição do evento (supabase/roleta.sql): sem "girar", só o estado (o quadro, o que a chave já ganhou e o
// preço do próximo giro); com "girar", a função girar_roleta sorteia NO BANCO, cobra e entrega. O giroId é o do jogo: o
// mesmo giroId de novo devolve o mesmo prêmio sem cobrar (o jogo reusa o id até ter uma resposta).
import { cabecalhos, ipDe } from "../http.js";
import { supabase } from "../supabase.js";
import { limitar } from "../rate-limit.js";
import { autenticarJogador, isoZ } from "../jogador.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOME_DA_ROLETA = /^[a-z0-9_]{1,32}$/;

async function estado(sb, chaveId, roletaId) {
  const [{ data: r }, { data: premios }, { count: giros }, { data: meus }, { data: saldo }] = await Promise.all([
    sb.from("roletas").select("id, nome, precos, inicio, fim, ativa").eq("id", roletaId).maybeSingle(),
    sb.from("roleta_premios").select("item_id, vaga, peso, loja_itens(nome, categoria)").eq("roleta_id", roletaId).order("vaga"),
    sb.from("roleta_giros").select("id", { count: "exact", head: true }).eq("chave_id", chaveId).eq("roleta_id", roletaId),
    sb.from("itens_da_chave").select("item_id").eq("chave_id", chaveId),
    sb.from("cupons_saldo").select("saldo").eq("chave_id", chaveId).maybeSingle(),
  ]);
  if (!r) return null;
  const tem = new Set((meus || []).map((m) => m.item_id));
  const lista = (premios || []).map((p) => ({
    id: p.item_id, vaga: p.vaga, peso: p.peso, nome: p.loja_itens?.nome || "", categoria: p.loja_itens?.categoria || "",
    ganho: tem.has(p.item_id),
  }));
  const feitos = giros || 0;
  const faltam = lista.some((p) => !p.ganho);
  const agora = Date.now();
  const precos = Array.isArray(r.precos) ? r.precos : [];
  return {
    roleta: r.id,
    nome: r.nome,
    inicio: isoZ(r.inicio),
    fim: isoZ(r.fim),
    aberta: r.ativa && agora >= new Date(r.inicio).getTime() && agora <= new Date(r.fim).getTime(),
    cupons: saldo?.saldo ?? 0,
    giros: feitos,
    precos,
    proximo_preco: faltam && precos.length ? precos[Math.min(feitos, precos.length - 1)] : 0,
    premios: lista,
    meus: [...tem],
  };
}

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, erro: "Método não permitido" });
  if (!(await limitar(`roleta:ip:${ipDe(req)}`, 120, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas." });

  try {
    const corpo = req.body || {};
    const roletaId = typeof corpo.roleta === "string" ? corpo.roleta.trim() : "";
    if (!NOME_DA_ROLETA.test(roletaId)) return res.status(400).json({ ok: false, erro: "Roleta inválida." });
    const girar = corpo.girar === true;
    const giroId = typeof corpo.giroId === "string" ? corpo.giroId.trim() : "";
    if (girar && !UUID.test(giroId)) return res.status(400).json({ ok: false, erro: "Giro inválido." });

    const sb = supabase();
    const auth = await autenticarJogador(sb, corpo);
    if (!auth.ok) return res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth);

    if (!girar) {
      const e = await estado(sb, auth.chave.id, roletaId);
      if (!e) return res.status(200).json({ ok: false, erro: "Roleta indisponível." });
      return res.status(200).json({ ok: true, ...e });
    }

    if (!(await limitar(`roleta:chave:${auth.chave.id}`, 40, 600)))
      return res.status(429).json({ ok: false, erro: "Muitos giros seguidos. Espere um pouco." });
    const { data, error } = await sb.rpc("girar_roleta", { p_chave: auth.chave.id, p_roleta: roletaId, p_giro: giroId });
    if (error) throw error;
    const g = Array.isArray(data) ? data[0] : data;
    const e = await estado(sb, auth.chave.id, roletaId);
    if (!g?.ok) return res.status(200).json({ ok: false, erro: g?.erro || "Não foi possível girar.", ...(e || { cupons: g?.saldo ?? 0 }) });
    return res.status(200).json({ ok: true, ...e, ganhou: g.item_id, preco: g.preco, repetida: !!g.repetida });
  } catch (e) {
    console.error("jogo/loja/roleta", e);
    return res.status(500).json({ ok: false, erro: "Erro na roleta." });
  }
}
