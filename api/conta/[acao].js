// CONTA GOOGLE e PROGRESSO NA NUVEM (supabase/contas.sql) — uma função só para as três rotas (a Vercel Hobby conta 12
// funções por deploy). Cada rota atende por dois caminhos: o direto desta função (/api/conta/google, /vincular,
// /progresso — o que o jogo usa) e o apelido em inglês que o vercel.json reescreve para cá (/api/auth/google,
// /api/auth/link-google, /api/player/progress).
//
// POST /api/auth/google       { idToken, deviceId? }
//   -> 200 { ok, sessao, expira, conta: { id, email, nome }, chave, vinculada }
//      Cria a conta na primeira vez. chave = o código RR-XXXX-XXXX ligado ("" se nenhum): num aparelho novo o jogo
//      ativa a chave com ele, sem o jogador digitar.
//   -> 401 { ok:false, erro } token do Google recusado · 403 { ok:false, banido, motivo } · 503 Google fora
// POST /api/auth/link-google  { idToken, codigo, deviceId }
//   Liga a conta Google à chave que ESTE aparelho já ativou (a mesma conferência do /api/jogo/validar: quem só sabe
//   o código da chave, sem o aparelho ativado nela, não liga). Uma chave por conta e uma conta por chave.
//   -> 200 como o /auth/google · 409 { ok:false, erro } chave de outra conta / conta com outra chave
// GET  /api/player/progress[?so=info]          Authorization: Bearer <sessao>
//   -> 200 { ok, existe, versao, atualizadoEm, tamanho, versaoDoJogo, dados? }   (dados = o save em TEXTO JSON)
// POST /api/player/progress  { dados, versaoBase, forcar?, versaoDoJogo? }   Authorization: Bearer <sessao>
//   dados = o rustingraids_save.json inteiro, como TEXTO; versaoBase = a versão da nuvem que o aparelho conhece (0 = nenhuma).
//   -> 200 { ok, versao, atualizadoEm } · 409 { ok:false, conflito:true, versao, atualizadoEm, erro } outro aparelho
//      gravou depois (o jogo pergunta e reenvia com forcar) · 413 save grande demais
//   Sessão vencida, derrubada ou de conta apagada: 401 { ok:false, sessao:false, erro } (o jogo entra de novo).
import { cabecalhos, ipDe, texto, acaoDaRota } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { banDoAparelho, aparelhoConfiavel } from "../_lib/banimento.js";
import { autenticarJogador, isoZ } from "../_lib/jogador.js";
import { MAX_DISPOSITIVOS, aparelhosDaChave, trocarAparelho } from "../_lib/aparelhos.js";
import { resumoDoAparelho } from "../_lib/bilhete.js";
import { conferirTokenDoGoogle, googleDisponivel } from "../_lib/google.js";
import { emitirSessao, lerSessao, tokenDoPedido, sessaoDisponivel } from "../_lib/sessao.js";

// O save solo de hoje tem ~20 KB; uma base enorme passa de 1 MB. A Vercel recusa corpo acima de 4,5 MB.
export const MAX_DO_SAVE = 3_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEM_SESSAO = { ok: false, sessao: false, erro: "Sessão expirada. Entre com o Google de novo." };

const ROTAS = new Map([
  ["google", { metodos: ["POST"], rodar: entrarComGoogle }],
  ["link-google", { metodos: ["POST"], rodar: vincularGoogle }],
  ["vincular", { metodos: ["POST"], rodar: vincularGoogle }],
  ["progress", { metodos: ["GET", "POST"], rodar: progresso }],
  ["progresso", { metodos: ["GET", "POST"], rodar: progresso }],
]);

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  const rota = ROTAS.get(acaoDaRota(req));
  if (!rota) return res.status(404).json({ ok: false, erro: "Rota não encontrada." });
  if (!rota.metodos.includes(req.method)) return res.status(405).json({ ok: false, erro: "Método não permitido" });
  // Sem as variáveis o login não pode funcionar: responde "fora" em vez de 500 com pilha.
  if (!sessaoDisponivel() || (rota.rodar !== progresso && !googleDisponivel()))
    return res.status(503).json({ ok: false, erro: "Login com Google ainda não está ligado no servidor." });

  try {
    let corpo = {};
    if (req.method === "POST") {
      try { corpo = req.body || {}; } catch { return res.status(400).json({ ok: false, erro: "JSON inválido." }); }
      if (typeof corpo !== "object" || Array.isArray(corpo)) return res.status(400).json({ ok: false, erro: "JSON inválido." });
    }
    return await rota.rodar(req, res, corpo, supabase());
  } catch (e) {
    console.error(`conta/${acaoDaRota(req)}`, e?.message || e);
    return res.status(500).json({ ok: false, erro: "Erro no servidor. Tente de novo daqui a pouco." });
  }
}

// ================================================================== entrar

async function entrarComGoogle(req, res, corpo, sb) {
  if (!(await limitar(`google:ip:${ipDe(req)}`, 30, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas. Espere um pouco." });

  const deviceId = texto(corpo.deviceId, 128);
  // Ban por APARELHO (decisão do Ronni): o aparelho banido não entra nem pela conta Google.
  if (deviceId) {
    const ban = await banDoAparelho(sb, deviceId);
    if (ban) return res.status(403).json({ ok: false, banido: true, motivo: ban.motivo });
  }

  const g = await googleOuResposta(res, corpo.idToken);
  if (!g) return;

  const { data, error } = await sb.rpc("entrar_com_google", { p_google: g.googleId, p_email: g.email, p_nome: g.nome });
  if (error) throw error;
  if (data.bloqueada) return res.status(403).json({ ok: false, banido: true, motivo: "Conta bloqueada." });
  if (data.chave_status === "banida") return res.status(403).json({ ok: false, banido: true, motivo: "Chave banida." });

  if (data.chave && aparelhoConfiavel(deviceId)) await abrirLugarNaChave(sb, data.chave, deviceId);
  return res.status(200).json(respostaDaConta(data, deviceId));
}

// Troca de aparelho pela conta Google (pedido do Ronni, 22/10): num aparelho novo, com a chave da conta já cheia, este
// aparelho toma na hora o lugar do aparelho parado há mais tempo. Logo depois o jogo ativa a chave (/api/jogo/ativar,
// ContaGoogle.Entrar), e ela já acha este aparelho. Nunca derruba a entrada: com erro, o /ativar responde como antes.
async function abrirLugarNaChave(sb, codigo, deviceId) {
  try {
    const { data: chave, error } = await sb.from("chaves").select("id").eq("codigo", codigo).maybeSingle();
    if (error) throw error;
    if (!chave) return;
    const aparelhos = await aparelhosDaChave(sb, chave.id);
    if (aparelhos.length < MAX_DISPOSITIVOS || aparelhos.some((j) => j.device_id === deviceId)) return;
    await trocarAparelho(sb, aparelhos, deviceId, { paradoHaMs: 0 });
  } catch (e) {
    console.error("conta/google: troca de aparelho", e?.message || e);
  }
}

// ================================================================== ligar à chave

async function vincularGoogle(req, res, corpo, sb) {
  if (!(await limitar(`vincular:ip:${ipDe(req)}`, 20, 600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas. Espere um pouco." });

  // Este aparelho tem de ser dono da chave (ativado nela, sem ban) — a mesma regra da loja.
  const auth = await autenticarJogador(sb, corpo);
  if (!auth.ok) return res.status(auth.banido ? 403 : auth.erro === "Dados inválidos." ? 400 : 403).json(auth);

  const g = await googleOuResposta(res, corpo.idToken);
  if (!g) return;

  const { data, error } = await sb.rpc("vincular_google", {
    p_google: g.googleId, p_email: g.email, p_nome: g.nome, p_chave: auth.chave.id,
  });
  if (error) {
    // A trava única (google_id / chave_id) pegou duas ligações ao mesmo tempo: a segunda perde.
    if (error.code === "23505") return res.status(409).json({ ok: false, erro: "A conta ou a chave acabou de ser ligada. Tente de novo." });
    throw error;
  }
  if (!data.ok) {
    const frases = {
      chave_de_outra_conta: "Esta chave já está ligada a outra conta Google.",
      conta_com_outra_chave: `Esta conta Google já está ligada à chave ${data.chave || "de outro jogador"}.`,
      conta_bloqueada: "Conta bloqueada.",
      chave_inexistente: "Chave não encontrada.",
    };
    const status = data.erro === "conta_bloqueada" ? 403 : data.erro === "chave_inexistente" ? 404 : 409;
    return res.status(status).json({ ok: false, erro: frases[data.erro] || "Não foi possível ligar a conta." });
  }
  return res.status(200).json(respostaDaConta(data, corpo.deviceId));
}

// ================================================================== progresso

async function progresso(req, res, corpo, sb) {
  const s = await contaDaSessao(sb, req);
  if (!s.ok) return res.status(s.status).json(s.corpo);

  if (req.method === "GET") {
    if (!(await limitar(`progresso:ler:${s.contaId}`, 120, 600)))
      return res.status(429).json({ ok: false, erro: "Muitos pedidos seguidos. Espere um pouco." });
    const soInfo = (req.query?.so ?? new URL(req.url || "/", "http://local").searchParams.get("so")) === "info";
    const { data, error } = await sb.rpc("ler_progresso", { p_conta: s.contaId, p_com_dados: !soInfo });
    if (error) throw error;
    if (!data?.existe) return res.status(200).json({ ok: true, existe: false, versao: 0 });
    return res.status(200).json({
      ok: true, existe: true, versao: data.versao, atualizadoEm: isoZ(data.atualizado_em),
      tamanho: data.tamanho, versaoDoJogo: data.versao_do_jogo || "",
      ...(soInfo ? {} : { dados: data.dados }),
    });
  }

  if (!(await limitar(`progresso:gravar:${s.contaId}`, 30, 600)))
    return res.status(429).json({ ok: false, erro: "Muitos salvamentos seguidos. Espere um pouco." });

  const dados = corpo.dados;
  if (typeof dados !== "string" || dados.length === 0) return res.status(400).json({ ok: false, erro: "Progresso vazio." });
  if (dados.length > MAX_DO_SAVE)
    return res.status(413).json({ ok: false, erro: "O save passou do limite da nuvem (3 MB)." });
  if (!pareceSaveDoJogo(dados)) return res.status(400).json({ ok: false, erro: "Isto não é um save do Rusting Raids." });

  const versaoBase = corpo.versaoBase ?? 0;
  if (!Number.isInteger(versaoBase) || versaoBase < 0) return res.status(400).json({ ok: false, erro: "Versão inválida." });

  const { data, error } = await sb.rpc("gravar_progresso", {
    p_conta: s.contaId, p_dados: dados, p_versao_base: versaoBase, p_forcar: corpo.forcar === true,
    p_disp: s.disp || null, p_versao_jogo: texto(corpo.versaoDoJogo, 40) || null,
  });
  if (error) {
    // Texto que o Postgres não aceita como jsonb (\u0000, número fora do padrão): problema do save, não do servidor.
    if (["22P02", "22P05", "22023"].includes(error.code)) return res.status(400).json({ ok: false, erro: "O save tem um formato que a nuvem não aceita." });
    throw error;
  }
  if (!data.ok)
    return res.status(409).json({
      ok: false, conflito: true, versao: data.versao, atualizadoEm: isoZ(data.atualizado_em),
      erro: "A nuvem tem um save gravado por outro aparelho depois do seu.",
    });
  return res.status(200).json({ ok: true, versao: data.versao, atualizadoEm: isoZ(data.atualizado_em) });
}

// ================================================================== ajudantes

// O token do Google conferido, ou a resposta de erro já enviada (devolve null).
async function googleOuResposta(res, idToken) {
  let g;
  try { g = await conferirTokenDoGoogle(idToken); }
  catch (e) {
    console.error("google: falha ao conferir", e?.message || e);
    res.status(503).json({ ok: false, erro: "Não consegui falar com o Google. Tente de novo." });
    return null;
  }
  if (!g.ok) {
    console.warn("google: token recusado:", g.motivo);
    res.status(401).json({ ok: false, erro: "O login do Google não foi aceito. Entre de novo." });
    return null;
  }
  return g;
}

function respostaDaConta(conta, deviceId) {
  const disp = aparelhoConfiavel(deviceId) ? resumoDoAparelho(deviceId) : "";
  const { sessao, exp } = emitirSessao({ contaId: conta.conta_id, sessaoVersao: conta.sessao_versao, disp });
  return {
    ok: true,
    sessao,
    expira: exp,
    conta: { id: conta.conta_id, email: conta.email || "", nome: conta.nome || "" },
    chave: conta.chave || "",
    vinculada: !!conta.chave,
  };
}

// -> { ok: true, contaId, disp }  |  { ok: false, status, corpo }
async function contaDaSessao(sb, req) {
  const carga = lerSessao(tokenDoPedido(req));
  if (!carga || !UUID.test(carga.sub)) return { ok: false, status: 401, corpo: SEM_SESSAO };
  const { data, error } = await sb.rpc("conta_da_sessao", { p_conta: carga.sub });
  if (error) throw error;
  if (!data || data.sessao_versao !== carga.sv) return { ok: false, status: 401, corpo: SEM_SESSAO };
  if (data.bloqueada) return { ok: false, status: 403, corpo: { ok: false, banido: true, motivo: "Conta bloqueada." } };
  if (data.chave_status === "banida") return { ok: false, status: 403, corpo: { ok: false, banido: true, motivo: "Chave banida." } };
  return { ok: true, contaId: carga.sub, disp: carga.disp };
}

// O formato do SalvamentoDoJogo (Game.Core/SalvamentoDoJogo.cs): { cabecalho: { jogo: "RustingRaids", ... },
// secoes: { ... }, fim: "ok" }. A nuvem guarda save do jogo, não qualquer JSON.
function pareceSaveDoJogo(textoDoSave) {
  let o;
  try { o = JSON.parse(textoDoSave); } catch { return false; }
  return !!o && typeof o === "object" && !Array.isArray(o)
    && o.cabecalho?.jogo === "RustingRaids" && o.fim === "ok"
    && !!o.secoes && typeof o.secoes === "object" && !Array.isArray(o.secoes);
}
