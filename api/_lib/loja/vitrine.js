// A VITRINE DE CADA JOGADOR (22/10; supabase/vitrines.sql). Pedidos do Ronni: "não tá aparecendo as molduras e avatar de
// perfil no rank de magnata, e quando eu clico no perfil deles não abre", "no esquadrão não aparece o perfil deles".
//
// POST /api/jogo/loja/vitrine  { codigo, deviceId, roleId, vitrine: { nome, avatar, moldura, balao, mochila, skin, arma,
//                                espera, papel, cabelo, masc, segundos, skins: [id], trocas: "116=150023;…" } }
//   -> { ok: true }  ou  { ok: false, erro }
//   O jogo conta a sua vitrine (ao abrir o lobby e quando ela muda). O roleId tem de ser o hash de um jogador DESTA chave
//   (o do servidor do jogo: BilheteDoSite.IdDoJogador), senão é recusado: ninguém grava a vitrine de outro.
// POST /api/jogo/loja/perfis   { codigo, deviceId, ids: ["roleId", ...] }   (até MAX_IDS)
//   -> { ok: true, perfis: [{ id, nome, avatar, moldura, balao, mochila, skin, arma, espera, papel, cabelo, masc, segundos,
//                             skins, trocas, em }] }
//   As vitrines dos outros (só quem já contou a sua; chave banida fica de fora). O nome é o apelido da chave, senão o que o
//   aparelho mandou. Só para quem tem chave (a mesma conferência do /validar).
import { createHash } from "node:crypto";
import { cabecalhos, ipDe, texto } from "../http.js";
import { supabase } from "../supabase.js";
import { limitar } from "../rate-limit.js";
import { autenticarJogador } from "../jogador.js";

export const MAX_IDS = 50;
export const MAX_SKINS = 5000;
export const MAX_TROCAS = 256;
const PRIMEIRO_JOGADOR = 1000000000n, ULTIMO_JOGADOR = 9999999999n;
const INTEIROS = ["avatar", "moldura", "balao", "mochila", "skin", "arma", "espera", "papel", "cabelo"];

// O roleId do servidor do jogo para um jogador do site: o mesmo cálculo do BilheteDoSite.IdDoJogador (C#).
export function roleIdDoJogador(uuid) {
  const h = createHash("sha256").update(String(uuid).trim().toLowerCase(), "utf8").digest();
  let v = 0n;
  for (let i = 0; i < 8; i++) v = (v << 8n) | BigInt(h[i]);
  return (PRIMEIRO_JOGADOR + (v % (ULTIMO_JOGADOR - PRIMEIRO_JOGADOR + 1n))).toString();
}

// "1234567890" (dez dígitos, na faixa dos jogadores) ou "".
export function roleIdValido(x) {
  const s = typeof x === "number" ? String(x) : typeof x === "string" ? x.trim() : "";
  if (!/^\d{10}$/.test(s)) return "";
  const n = BigInt(s);
  return n >= PRIMEIRO_JOGADOR && n <= ULTIMO_JOGADOR ? s : "";
}

const inteiro = (x) => { const n = Number(x); return Number.isInteger(n) && n >= 0 && n <= 2147483647 ? n : 0; };

function lista(x, max) {
  if (!Array.isArray(x)) return [];
  const vistos = new Set();
  for (const y of x) {
    const n = inteiro(y);
    if (n > 0) vistos.add(n);
    if (vistos.size >= max) break;
  }
  return [...vistos];
}

// O nome vai para um Text da Unity, que entende rich text: sem < >, sem controle, até 24 letras.
function nomeLimpo(x) {
  const t = texto(typeof x === "string" ? x.replace(/[<>\u0000-\u001f\u007f]/g, "") : "", 64);
  return [...t].slice(0, 24).join("").trim();
}

export function limparVitrine(v) {
  const d = { nome: nomeLimpo(v?.nome) };
  for (const k of INTEIROS) d[k] = inteiro(v?.[k]);
  d.masc = v?.masc !== false;
  const s = Number(v?.segundos);
  d.segundos = Number.isFinite(s) && s > 0 ? Math.min(Math.floor(s), 1e10) : 0;
  // As partes de outras skins vestidas (a skin por partes: "vaga=id" separados), como o jogo manda; só dígitos e separadores.
  d.trocas = typeof v?.trocas === "string" && v.trocas.length <= MAX_TROCAS && /^[0-9=,;|]*$/.test(v.trocas) ? v.trocas : "";
  return { dados: d, skins: lista(v?.skins, MAX_SKINS) };
}

async function conferirChave(req, res, nome, porIp) {
  if (cabecalhos(req, res)) return null;
  if (req.method !== "POST") { res.status(405).json({ ok: false, erro: "Método não permitido" }); return null; }
  if (!(await limitar(`${nome}:ip:${ipDe(req)}`, porIp, 600))) { res.status(429).json({ ok: false, erro: "Muitas tentativas." }); return null; }
  const sb = supabase();
  const auth = await autenticarJogador(sb, req.body || {});
  if (!auth.ok) { res.status(auth.erro === "Dados inválidos." ? 400 : 200).json(auth); return null; }
  return { sb, auth };
}

export async function mandarVitrine(req, res) {
  try {
    const c = await conferirChave(req, res, "vitrine", 60);
    if (!c) return;
    const { sb, auth } = c;
    const corpo = req.body || {};
    const roleId = roleIdValido(corpo.roleId);
    if (!roleId) return res.status(400).json({ ok: false, erro: "ID inválido." });
    if (!(await limitar(`vitrine:chave:${auth.chave.id}`, 20, 600)))
      return res.status(429).json({ ok: false, erro: "Muitas vitrines seguidas. Espere um pouco." });

    const { data: jogadores, error: e1 } = await sb.from("jogadores").select("id").eq("chave_id", auth.chave.id);
    if (e1) throw e1;
    if (!(jogadores || []).some((j) => roleIdDoJogador(j.id) === roleId))
      return res.status(200).json({ ok: false, erro: "Este ID não é desta chave." });

    const { dados, skins } = limparVitrine(corpo.vitrine);
    const { data, error } = await sb.rpc("gravar_vitrine", { p_chave: auth.chave.id, p_role: Number(roleId), p_dados: dados, p_skins: skins });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    if (!r?.ok) return res.status(200).json({ ok: false, erro: r?.erro || "A vitrine não foi gravada." });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("jogo/loja/vitrine", e);
    return res.status(500).json({ ok: false, erro: "Erro ao gravar a vitrine." });
  }
}

export async function pedirPerfis(req, res) {
  try {
    const c = await conferirChave(req, res, "perfis", 240);
    if (!c) return;
    const { sb, auth } = c;
    const corpo = req.body || {};
    const ids = [...new Set((Array.isArray(corpo.ids) ? corpo.ids : []).map(roleIdValido).filter(Boolean))].slice(0, MAX_IDS);
    if (ids.length === 0) return res.status(200).json({ ok: true, perfis: [] });
    if (!(await limitar(`perfis:chave:${auth.chave.id}`, 120, 600)))
      return res.status(429).json({ ok: false, erro: "Muitos pedidos seguidos. Espere um pouco." });

    const { data, error } = await sb.rpc("vitrines_por_role", { p_ids: ids.map(Number) });
    if (error) throw error;
    const perfis = (data || []).map((v) => {
      const d = v.dados || {};
      const p = { id: String(v.role_id), nome: v.apelido || d.nome || "Sobrevivente" };
      for (const k of INTEIROS) p[k] = inteiro(d[k]);
      p.masc = d.masc !== false;
      p.segundos = Number(d.segundos) || 0;
      p.skins = Array.isArray(v.skins) ? v.skins : [];
      p.trocas = typeof d.trocas === "string" ? d.trocas : "";
      p.em = v.atualizado_em ? new Date(v.atualizado_em).toISOString() : "";
      return p;
    });
    return res.status(200).json({ ok: true, perfis });
  } catch (e) {
    console.error("jogo/loja/perfis", e);
    return res.status(500).json({ ok: false, erro: "Erro ao carregar os perfis." });
  }
}
