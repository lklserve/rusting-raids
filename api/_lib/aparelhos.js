// Os aparelhos de uma chave (tabela jogadores): o limite e a TROCA de aparelho (pedido do Ronni, 2026-10-22: "quero
// que os player consiga trocar de dispositivo e usar as conta deles e fazer recarga").
//
// A troca NÃO apaga a linha do aparelho velho: a MESMA linha (o mesmo id de jogador) passa para o aparelho novo. O
// perfis_do_jogo aponta para jogadores com ON DELETE CASCADE, e o id do jogador vai no bilhete do servidor. O aparelho
// velho deixa de valer: o /validar dele responde "Aparelho não ativado" e o jogo pede a chave de novo.

export const MAX_DISPOSITIVOS = 3; // aparelhos ao mesmo tempo numa chave

// Quem só digita a chave troca o aparelho parado há mais tempo, se ele está parado (sem abrir o jogo: o /validar e o
// /bilhete marcam o ultimo_acesso) há pelo menos 24 h. Um celular novo entra; uma chave emprestada não roda entre quatro
// pessoas jogando no mesmo dia. Quem entra com a conta Google ligada à chave troca na hora: o Google prova que é o dono.
export const PARADO_PARA_TROCAR_MS = 24 * 60 * 60 * 1000;

export const CHAVE_CHEIA =
  `Esta chave já está em ${MAX_DISPOSITIVOS} aparelhos. Para jogar neste, entre com a conta Google ligada à chave, ` +
  "ou deixe um dos aparelhos antigos 24 horas sem abrir o jogo.";

const COLUNAS = "id, device_id, banido, criado_em, ultimo_acesso";

const usadoEm = (j) => Date.parse(j.ultimo_acesso || j.criado_em || "") || 0;

// Os aparelhos da chave, com o que a troca precisa.
export async function aparelhosDaChave(sb, chaveId) {
  const { data, error } = await sb.from("jogadores").select(COLUNAS).eq("chave_id", chaveId);
  if (error) throw error;
  return data || [];
}

// Há um aparelho que a troca pode tirar (o mesmo filtro do trocarAparelho), sem mexer em nada: a prévia da troca de
// chave da conta (api/conta/[acao].js, trocar) diz antes se este aparelho cabe.
export function haAparelhoParaTrocar(aparelhos, paradoHaMs = PARADO_PARA_TROCAR_MS) {
  const agora = Date.now();
  return aparelhos.some((j) => !j.banido && agora - usadoEm(j) >= paradoHaMs);
}

// Passa para `deviceId` a linha do aparelho parado há mais tempo (nunca a de um aparelho banido: o ban iria junto).
// -> { id } do jogador (a mesma linha, agora deste aparelho) | null se nenhum aparelho pode sair ou se outro pedido
// mexeu nele ao mesmo tempo (quem chamou confere de novo).
export async function trocarAparelho(sb, aparelhos, deviceId, { nome = null, paradoHaMs = PARADO_PARA_TROCAR_MS } = {}) {
  const agora = Date.now();
  const alvo = aparelhos
    .filter((j) => !j.banido && agora - usadoEm(j) >= paradoHaMs)
    .sort((a, b) => usadoEm(a) - usadoEm(b))[0];
  if (!alvo) return null;

  const { data, error } = await sb.from("jogadores").update({
    device_id: deviceId,
    ultimo_acesso: new Date(agora).toISOString(),
    ...(nome ? { nome } : {}),
  }).eq("id", alvo.id).eq("device_id", alvo.device_id).eq("banido", false).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return null; // este aparelho acabou de entrar na chave por outro pedido
    throw error;
  }
  if (data) console.info("troca de aparelho", { jogador: alvo.id, de: String(alvo.device_id).slice(0, 8), para: deviceId.slice(0, 8) });
  return data || null;
}
