// A mesma conferência do /api/jogo/validar, para as rotas do jogo que mexem na conta (a loja):
// aparelho não banido, chave existente e ativa, e este aparelho ativado nela sem ban.
// -> { ok: true, chave: { id, codigo }, jogadorId }  ou  { ok: false, ...resposta pronta para o jogo }
import { normalizarCodigo, texto } from "./http.js";
import { banDoAparelho } from "./banimento.js";

export async function autenticarJogador(sb, corpo) {
  const codigo = normalizarCodigo(corpo?.codigo);
  const deviceId = texto(corpo?.deviceId, 128);
  if (!codigo || !deviceId) return { ok: false, erro: "Dados inválidos." };

  const ban = await banDoAparelho(sb, deviceId);
  if (ban) return { ok: false, banido: true, motivo: ban.motivo };

  const { data: chave } = await sb.from("chaves").select("id, codigo, status").eq("codigo", codigo).maybeSingle();
  if (!chave) return { ok: false, erro: "Chave não encontrada." };
  if (chave.status === "banida") return { ok: false, banido: true, motivo: "Chave banida." };

  const { data: jogador } = await sb.from("jogadores")
    .select("id, banido, motivo_ban").eq("chave_id", chave.id).eq("device_id", deviceId).maybeSingle();
  if (!jogador) return { ok: false, erro: "Aparelho não ativado. Cole a chave no painel." };
  if (jogador.banido) return { ok: false, banido: true, motivo: jogador.motivo_ban || "Você foi banido." };

  return { ok: true, chave: { id: chave.id, codigo: chave.codigo }, jogadorId: jogador.id };
}

// Data para o jogo: SEMPRE ISO-8601 em UTC com "Z" (o jogo lê com ParseExact e recusa o "+00:00" cru do Supabase).
export const isoZ = (d) => new Date(d).toISOString();

// O prazo da Coleta Automática desta chave (contrato farm_automatico §2.2): farm_ate = "" se nunca assinou.
export async function prazoDoFarm(sb, chaveId) {
  const { data, error } = await sb.from("assinaturas_da_chave").select("ate")
    .eq("chave_id", chaveId).eq("recurso", "farm").maybeSingle();
  if (error) throw error;
  return { farm_ate: data?.ate ? isoZ(data.ate) : "", agora: isoZ(Date.now()) };
}

// A mesma coisa sem nunca derrubar a resposta: o /validar e o /ativar conferem a CHAVE, e uma falha na coleta
// não pode trancar o jogo. Sem os campos, o jogo só não atualiza o prazo (o contrato só acrescenta campos).
export async function prazoOuNada(sb, chaveId) {
  try { return await prazoDoFarm(sb, chaveId); }
  catch (e) { console.error("prazoDoFarm", e?.message || e); return {}; }
}

// O que a loja mostra para uma chave: saldo, itens à venda, os que ela já tem, os pacotes de recarga,
// os planos da Coleta Automática e o prazo dela.
export async function estadoDaLoja(sb, chaveId) {
  const [{ data: saldo }, { data: itens }, { data: meus }, { data: pacotes }, { data: planos }, prazo] = await Promise.all([
    sb.from("cupons_saldo").select("saldo").eq("chave_id", chaveId).maybeSingle(),
    sb.from("loja_itens").select("id, categoria, nome, preco_cupons").eq("ativo", true).order("ordem").order("id"),
    sb.from("itens_da_chave").select("item_id").eq("chave_id", chaveId),
    sb.from("loja_pacotes").select("id, reais, cupons, bonus").eq("ativo", true).order("ordem"),
    sb.from("loja_planos").select("id, nome, preco_cupons, dias").eq("ativo", true).order("ordem"),
    prazoOuNada(sb, chaveId),
  ]);
  return {
    cupons: saldo?.saldo ?? 0,
    itens: (itens || []).map((i) => ({ id: i.id, categoria: i.categoria, nome: i.nome, preco: i.preco_cupons })),
    meus: (meus || []).map((m) => m.item_id),
    pacotes: (pacotes || []).map((p) => ({ id: p.id, reais: Number(p.reais), cupons: p.cupons, bonus: p.bonus })),
    planos: (planos || []).map((p) => ({ id: p.id, nome: p.nome, preco: p.preco_cupons, dias: p.dias })),
    ...prazo,
  };
}
