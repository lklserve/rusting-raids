// O apelido da chave (supabase/apelido.sql): as regras do jogo e a leitura para o bilhete e para a loja.
//
// As MESMAS regras do PerfilDoJogador.ValidarNome do jogo (Assets/Scripts/Game.Core/PerfilDoJogador.cs): de 2 a 10
// letras como se vê na tela (grafemas), sem espaço nem branco, sem < e >, sem emoji (nada fora do plano básico do
// Unicode) e sem os invisíveis (controle e formatação).
export const PRECO_DO_APELIDO = 100;
export const APELIDO_MINIMO = 2;
export const APELIDO_MAXIMO = 10;

const segmentador = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("pt", { granularity: "grapheme" }) : null;
const tamanho = (s) => (segmentador ? [...segmentador.segment(s)].length : [...s].length);

// -> null se serve; senão a frase para o jogador (as do jogo).
export function validarApelido(nome) {
  const n = typeof nome === "string" ? nome.trim() : "";
  if (!n) return "Nome não pode ficar vazio";
  for (const ch of n) {
    if (/\s/u.test(ch)) return "O apelido não pode ter espaço";
    if (ch === "<" || ch === ">") return "O apelido não pode ter < nem >";
    if (ch.codePointAt(0) > 0xffff) return "O apelido não pode ter emoji (não aparece no jogo). Use símbolos como ★ ♥ ✓";
    if (/[\p{Cc}\p{Cf}]/u.test(ch)) return "Há caracteres invisíveis ou inválidos no apelido";
  }
  const t = tamanho(n);
  if (t < APELIDO_MINIMO) return "Nome muito curto";
  if (t > APELIDO_MAXIMO) return "Nome muito longo";
  return null;
}

// O apelido da chave, ou "" (sem a tabela ainda, ou erro: "" — o bilhete e a loja nunca caem por causa dele).
export async function apelidoDaChave(sb, chaveId) {
  try {
    const { data, error } = await sb.from("apelidos_da_chave").select("apelido").eq("chave_id", chaveId).maybeSingle();
    if (error) throw error;
    return data?.apelido || "";
  } catch (e) {
    console.error("apelidoDaChave", e?.message || e);
    return "";
  }
}

// Para o bilhete: o apelido da chave; sem nenhum ainda, registra o que o jogo mandou (o primeiro é de graça).
export async function apelidoParaEntrar(sb, chaveId, sugerido) {
  const atual = await apelidoDaChave(sb, chaveId);
  if (atual) return atual;
  const nome = typeof sugerido === "string" ? sugerido.trim() : "";
  if (!nome || validarApelido(nome)) return "";
  try {
    const { data, error } = await sb.rpc("definir_apelido", { p_chave: chaveId, p_apelido: nome, p_preco: PRECO_DO_APELIDO });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    return r?.ok ? r.apelido || nome : "";
  } catch (e) {
    console.error("apelidoParaEntrar", e?.message || e);
    return "";
  }
}
