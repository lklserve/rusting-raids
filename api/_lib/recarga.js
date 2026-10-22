// A RECARGA EM DOBRO (supabase/recarga_em_dobro.sql; pedidos do Ronni de 21/10): toda chave ganha o dobro UMA vez, na
// próxima recarga aprovada — a que ainda não tem no livro-caixa um crédito com a marca do dobro. (Até a noite de 21/10
// era só a chave que nunca tinha recarregado: "ative o dobro para todos a partir de hoje".) Quem decide de verdade é o
// banco, na hora do crédito; isto só diz à página e ao jogo se a chave ainda tem direito. Na dúvida (erro do banco), diz
// que não: nunca prometer o dobro.
export const MARCA_DO_DOBRO = "primeira recarga em dobro";

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
