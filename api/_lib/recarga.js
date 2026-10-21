// A PRIMEIRA RECARGA EM DOBRO (supabase/recarga_em_dobro.sql; pedido do Ronni de 21/10): a chave que ainda não tem
// nenhuma recarga no livro-caixa ganha o dobro na primeira. Quem decide de verdade é o banco, na hora do crédito; isto
// só diz à página e ao jogo se a chave ainda tem direito. Na dúvida (erro do banco), diz que não: nunca prometer o dobro.
export async function recargaEmDobro(sb, chaveId) {
  try {
    const { data, error } = await sb.from("cupons_movimentos").select("id")
      .eq("chave_id", chaveId).eq("tipo", "recarga").limit(1);
    if (error) throw error;
    return (data || []).length === 0;
  } catch (e) {
    console.error("recargaEmDobro", e?.message || e);
    return false;
  }
}
