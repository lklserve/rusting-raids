// O pedido novo com a prova do aceite dos Termos (24/10): a versão que a pessoa marcou na janela de compra ou na
// recarga (o value da caixa de aceite) e a hora, nas colunas termos_versao/termos_aceitos_em (supabase/conformidade.sql).
// Antes de o SQL rodar as colunas não existem: o PostgREST responde PGRST204 (ou o Postgres 42703) e o pedido entra
// sem elas — a compra nunca para por causa disso.
export function camposDoAceite(aceite) {
  const versao = typeof aceite === "string" && /^\d{4}-\d{2}-\d{2}$/.test(aceite) ? aceite : null;
  return versao ? { termos_versao: versao, termos_aceitos_em: new Date().toISOString() } : {};
}

// -> { data: { id }, error } como o supabase-js
export async function inserirPedido(sb, linha, aceite) {
  const extra = camposDoAceite(aceite);
  let r = await sb.from("pedidos").insert({ ...linha, ...extra }).select("id").single();
  if (r.error && Object.keys(extra).length && ["PGRST204", "42703"].includes(r.error.code)) {
    console.warn("pedidos sem as colunas do aceite (rode supabase/conformidade.sql):", r.error.message);
    r = await sb.from("pedidos").insert(linha).select("id").single();
  }
  return r;
}
