// A RECARGA EM DOBRO (supabase/recarga_em_dobro.sql; pedidos do Ronni de 21/10): toda chave ganha o dobro UMA vez, na
// próxima recarga aprovada — a que ainda não tem no livro-caixa um crédito com a marca do dobro. (Até a noite de 21/10
// era só a chave que nunca tinha recarregado: "ative o dobro para todos a partir de hoje".) Quem decide de verdade é o
// banco, na hora do crédito; isto só diz à página e ao jogo se a chave ainda tem direito. Na dúvida (erro do banco), diz
// que não: nunca prometer o dobro.
export const MARCA_DO_DOBRO = "primeira recarga em dobro";

// A RECARGA COM VALOR LIVRE (Ronni, 29/10: "uma opção de estar fazendo recarga de outros valores ... ele faz o cálculo
// exato de cada cupom ... quanto maior for a recarga, mais porcentagem de cupom ele vai alcançar. O máximo é 80%").
// Escolhas dele: de R$ 5 a R$ 500, em reais inteiros; 20 cupons por real e um bônus que sobe em linha reta de 5% (R$ 5)
// a 80% (R$ 500), arredondado para baixo; os pacotes seguem a mesma tabela (supabase/recarga_livre.sql), então nunca
// dão menos que digitar o mesmo valor. A página (assets/js/recarga.js) faz a mesma conta com estes números, que o
// /api/loja/pacotes devolve em "livre"; quem decide o que entra é o servidor, no /api/pix/recarga.
export const RECARGA_LIVRE = Object.freeze({ minimo: 5, maximo: 500, cuponsPorReal: 20, bonusMinimo: 5, bonusMaximo: 80 });

/** Os cupons de bônus de uma recarga de `reais` (inteiro, já validado): conta inteira, sem erro de vírgula. */
export function bonusDaRecarga(reais) {
  const { minimo, maximo, cuponsPorReal, bonusMinimo, bonusMaximo } = RECARGA_LIVRE;
  const v = Math.min(Math.max(reais, minimo), maximo);
  const faixa = maximo - minimo;
  return Math.floor(v * cuponsPorReal * (bonusMinimo * faixa + (bonusMaximo - bonusMinimo) * (v - minimo)) / (100 * faixa));
}

/** O valor digitado em reais inteiros dentro da faixa, ou null ("12", 12 e "12,00" valem; "12,50" e "4" não). */
export function valorLivre(entrada) {
  const s = String(entrada ?? "").trim().replace(",", ".");
  if (!/^\d{1,4}(\.0{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= RECARGA_LIVRE.minimo && n <= RECARGA_LIVRE.maximo ? n : null;
}

export async function recargaEmDobro(sb, chaveId) {
  try {
    const { data, error } = await sb.from("cupons_movimentos").select("id")
      .eq("chave_id", chaveId).eq("tipo", "recarga").eq("observacao", MARCA_DO_DOBRO).limit(1);
    if (error) throw error;
    return (data || []).length === 0;
  } catch (e) {
    console.error("recargaEmDobro", e?.message || e);
    return false;
  }
}
