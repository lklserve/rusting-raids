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
// POST /api/conta/criar  { deviceId }   Authorization: Bearer <sessao>          (lançamento aberto, 27/10)
//   A conta Google sem chave ganha a sua (supabase/lancamento_aberto.sql): o jogo não vende mais chave e só entra pelo
//   Google; a chave fica por baixo, como a conta dos cupons, das skins e do personagem. Pedido repetido devolve a mesma.
//   -> 200 como o /auth/google (chave preenchida; o jogo ativa a chave neste aparelho sem o jogador ver)
//   -> 401 sessão · 403 { banido, motivo } aparelho banido ou conta bloqueada · 429
// POST /api/conta/trocar  { codigo, deviceId, previa? }   Authorization: Bearer <sessao>       (28/10)
//   A conta Google passa a abrir OUTRA chave (supabase/trocas_de_chave.sql): quem tinha o Google ligado à chave secundária
//   e ficou sem a principal depois do lançamento aberto. A prova de dono é a do /api/jogo/ativar (o código da chave, com
//   lugar para este aparelho); este aparelho entra na chave nova. A de antes fica livre; até 3 trocas por conta em 7 dias.
//   previa: true -> 200 { ok, previa, atual: {codigo, playerId, cupons, itens}, nova: {...}, aparelho: ativado|livre|troca }
//   sem previa   -> 200 como o /auth/google (chave = a nova) + { troca, playerId }
//   -> 400 código · 404 chave · 409 { erro } a chave é de outra conta / já é a sua / cheia · 403 banido · 429 limite
// GET  /api/player/progress[?so=info]          Authorization: Bearer <sessao>
//   -> 200 { ok, existe, versao, atualizadoEm, tamanho, versaoDoJogo, dados? }   (dados = o save em TEXTO JSON)
// POST /api/player/progress  { dados, versaoBase, forcar?, versaoDoJogo? }   Authorization: Bearer <sessao>
//   dados = o rustingraids_save.json inteiro, como TEXTO; versaoBase = a versão da nuvem que o aparelho conhece (0 = nenhuma).
//   -> 200 { ok, versao, atualizadoEm } · 409 { ok:false, conflito:true, versao, atualizadoEm, erro } outro aparelho
//      gravou depois (o jogo pergunta e reenvia com forcar) · 413 save grande demais
//   Sessão vencida, derrubada ou de conta apagada: 401 { ok:false, sessao:false, erro } (o jogo entra de novo).
import { cabecalhos, ipDe, texto, acaoDaRota, normalizarCodigo } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { limitar } from "../_lib/rate-limit.js";
import { banDoAparelho, aparelhoConfiavel } from "../_lib/banimento.js";
import { autenticarJogador, isoZ } from "../_lib/jogador.js";
import { MAX_DISPOSITIVOS, CHAVE_CHEIA, aparelhosDaChave, trocarAparelho, haAparelhoParaTrocar } from "../_lib/aparelhos.js";
import { resumoDoAparelho } from "../_lib/bilhete.js";
import { conferirTokenDoGoogle, googleDisponivel } from "../_lib/google.js";
import { emitirSessao, lerSessao, tokenDoPedido, sessaoDisponivel } from "../_lib/sessao.js";
import { gerarCodigo } from "../_lib/keygen.js";

// O save solo de hoje tem ~20 KB; uma base enorme passa de 1 MB. A Vercel recusa corpo acima de 4,5 MB.
export const MAX_DO_SAVE = 3_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEM_SESSAO = { ok: false, sessao: false, erro: "Sessão expirada. Entre com o Google de novo." };

const ROTAS = new Map([
  ["google", { metodos: ["POST"], rodar: entrarComGoogle }],
  ["link-google", { metodos: ["POST"], rodar: vincularGoogle }],
  ["vincular", { metodos: ["POST"], rodar: vincularGoogle }],
  ["criar", { metodos: ["POST"], rodar: criarConta }],
  ["trocar", { metodos: ["POST"], rodar: trocarDeChave }],
  ["progress", { metodos: ["GET", "POST"], rodar: progresso }],
  ["progresso", { metodos: ["GET", "POST"], rodar: progresso }],
]);

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  const rota = ROTAS.get(acaoDaRota(req));
  if (!rota) return res.status(404).json({ ok: false, erro: "Rota não encontrada." });
  if (!rota.metodos.includes(req.method)) return res.status(405).json({ ok: false, erro: "Método não permitido" });
  // Sem as variáveis o login não pode funcionar: responde "fora" em vez de 500 com pilha.
  if (!sessaoDisponivel() || (rota.rodar !== progresso && rota.rodar !== criarConta && rota.rodar !== trocarDeChave && !googleDisponivel()))
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

// ================================================================== conta nova (lançamento aberto)

async function criarConta(req, res, corpo, sb) {
  const s = await contaDaSessao(sb, req);
  if (!s.ok) return res.status(s.status).json(s.corpo);
  if (!(await limitar(`criar:ip:${ipDe(req)}`, 10, 3600)) || !(await limitar(`criar:conta:${s.contaId}`, 5, 3600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas. Espere um pouco." });

  // O aparelho banido não abre conta nova (o ban do Ronni é por aparelho).
  const deviceId = texto(corpo.deviceId, 128);
  if (deviceId) {
    const ban = await banDoAparelho(sb, deviceId);
    if (ban) return res.status(403).json({ ok: false, banido: true, motivo: ban.motivo });
  }

  // O código sai do gerador criptográfico; a colisão (23505, uma em ~10^12) tenta outro.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const { data, error } = await sb.rpc("criar_chave_da_conta", { p_conta: s.contaId, p_codigo: gerarCodigo() });
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    if (!data.ok) {
      if (data.erro === "conta_bloqueada") return res.status(403).json({ ok: false, banido: true, motivo: "Conta bloqueada." });
      return res.status(401).json(SEM_SESSAO);
    }
    if (data.criada) console.info("conta nova", { conta: String(data.conta_id).slice(0, 8) });
    return res.status(200).json(respostaDaConta(data, deviceId));
  }
  return res.status(503).json({ ok: false, erro: "Não consegui criar a conta agora. Tente de novo." });
}

// ================================================================== trocar a chave da conta (28/10)

const FRASES_DA_TROCA = {
  chave_de_outra_conta: "Esta chave já está ligada a outra conta Google. Se ela é sua, fale com o suporte.",
  mesma_chave: "Esta já é a chave da sua conta.",
  limite: "Você já trocou de conta 3 vezes nesta semana. Se precisar de outra troca, fale com o suporte.",
  chave_inexistente: "Chave não encontrada. Confira as letras e os números.",
};

// O que a tela do jogo mostra de cada chave: o Player ID (o personagem do servidor), os cupons e os itens da loja.
async function resumoDaChave(sb, chaveId) {
  if (!chaveId) return null;
  const [{ data: k }, { data: s }, { data: itens }] = await Promise.all([
    sb.from("chaves").select("codigo, player_id, criado_em").eq("id", chaveId).maybeSingle(),
    sb.from("cupons_saldo").select("saldo").eq("chave_id", chaveId).maybeSingle(),
    sb.from("itens_da_chave").select("item_id").eq("chave_id", chaveId),
  ]);
  if (!k) return null;
  return {
    codigo: k.codigo, playerId: k.player_id != null ? String(k.player_id) : "",
    cupons: s?.saldo || 0, itens: (itens || []).length, criadaEm: k.criado_em ? isoZ(k.criado_em) : "",
  };
}

async function trocarDeChave(req, res, corpo, sb) {
  const s = await contaDaSessao(sb, req);
  if (!s.ok) return res.status(s.status).json(s.corpo);
  const previa = corpo.previa === true;
  if (!(await limitar(`trocar:ip:${ipDe(req)}`, 30, 600)) || !(await limitar(`trocar:conta:${s.contaId}`, previa ? 30 : 8, 3600)))
    return res.status(429).json({ ok: false, erro: "Muitas tentativas. Espere um pouco." });

  const codigo = normalizarCodigo(corpo.codigo);
  const deviceId = texto(corpo.deviceId, 128);
  if (!codigo) return res.status(400).json({ ok: false, erro: "Digite a chave no formato RR-XXXX-XXXX." });
  if (!aparelhoConfiavel(deviceId)) return res.status(400).json({ ok: false, erro: "Aparelho não identificado." });
  const ban = await banDoAparelho(sb, deviceId);
  if (ban) return res.status(403).json({ ok: false, banido: true, motivo: ban.motivo });

  const [{ data: conta, error: e1 }, { data: nova, error: e2 }] = await Promise.all([
    sb.from("contas").select("id, chave_id").eq("id", s.contaId).maybeSingle(),
    sb.from("chaves").select("id, codigo, status").eq("codigo", codigo).maybeSingle(),
  ]);
  if (e1 || e2) throw e1 || e2;
  if (!nova) return res.status(404).json({ ok: false, erro: FRASES_DA_TROCA.chave_inexistente });
  if (nova.status === "banida") return res.status(403).json({ ok: false, banido: true, motivo: "Esta chave foi banida." });
  if (conta?.chave_id === nova.id) return res.status(409).json({ ok: false, erro: FRASES_DA_TROCA.mesma_chave });
  const { data: dona, error: e3 } = await sb.from("contas").select("id").eq("chave_id", nova.id).maybeSingle();
  if (e3) throw e3;
  if (dona) return res.status(409).json({ ok: false, erro: FRASES_DA_TROCA.chave_de_outra_conta });

  // A prova de dono é a do /api/jogo/ativar: o código da chave, com lugar para este aparelho (ou um parado há 24 h).
  const aparelhos = await aparelhosDaChave(sb, nova.id);
  const meu = aparelhos.find((j) => j.device_id === deviceId);
  if (meu?.banido) return res.status(403).json({ ok: false, banido: true, motivo: "Este aparelho foi banido nesta chave." });
  const aparelho = meu ? "ativado" : aparelhos.length < MAX_DISPOSITIVOS ? "livre" : haAparelhoParaTrocar(aparelhos) ? "troca" : "";
  if (!aparelho) return res.status(409).json({ ok: false, erro: CHAVE_CHEIA });

  if (previa) {
    const [atual, depois] = await Promise.all([resumoDaChave(sb, conta?.chave_id), resumoDaChave(sb, nova.id)]);
    return res.status(200).json({ ok: true, previa: true, atual, nova: depois, aparelho });
  }

  // Este aparelho entra na chave nova antes (como o /ativar); se a troca for recusada depois, ele só fica ativado nela.
  if (aparelho === "livre") {
    const { error } = await sb.from("jogadores").insert({
      chave_id: nova.id, device_id: deviceId, criado_em: new Date().toISOString(), ultimo_acesso: new Date().toISOString(),
    });
    if (error && error.code !== "23505") throw error;
  } else if (aparelho === "troca") {
    if (!(await trocarAparelho(sb, aparelhos, deviceId))) return res.status(409).json({ ok: false, erro: CHAVE_CHEIA });
  }

  const { data, error } = await sb.rpc("trocar_chave_da_conta", {
    p_conta: s.contaId, p_destino: nova.id, p_origem: "jogo", p_por: "jogo", p_motivo: null, p_device: deviceId,
  });
  if (error) {
    if (error.code === "23505") return res.status(409).json({ ok: false, erro: "A chave acabou de ser ligada. Tente de novo." });
    throw error;
  }
  if (!data.ok) {
    if (data.erro === "conta_bloqueada") return res.status(403).json({ ok: false, banido: true, motivo: "Conta bloqueada." });
    if (data.erro === "chave_banida") return res.status(403).json({ ok: false, banido: true, motivo: "Esta chave foi banida." });
    const status = data.erro === "limite" ? 429 : data.erro === "chave_inexistente" ? 404 : 409;
    return res.status(status).json({ ok: false, erro: FRASES_DA_TROCA[data.erro] || "Não foi possível trocar de conta." });
  }
  await sb.from("chaves").update({ ultimo_uso: new Date().toISOString() }).eq("id", nova.id);
  console.info("troca de chave pelo jogo", { conta: String(s.contaId).slice(0, 8), troca: String(data.troca).slice(0, 8) });
  const depois = await resumoDaChave(sb, nova.id);
  return res.status(200).json({ ...respostaDaConta(data, deviceId), troca: data.troca, playerId: depois?.playerId || "" });
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
