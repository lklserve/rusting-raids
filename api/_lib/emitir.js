// Emite a chave de um pedido aprovado. IDEMPOTENTE: chamado tanto pelo webhook quanto
// pela consulta de status; se o pedido já tem chave, devolve a MESMA (nunca gera duas).
// A trava real é o `pedido_id` UNIQUE na tabela `chaves`: numa corrida, um insert vence
// e o outro cai na leitura da chave que já existe.
import { supabase } from "./supabase.js";
import { gerarCodigo } from "./keygen.js";

export async function emitirChave(pedidoId) {
  const sb = supabase();
  const { data: pedido } = await sb.from("pedidos").select("*").eq("id", pedidoId).maybeSingle();
  if (!pedido) throw new Error("Pedido não encontrado");

  // Já existe chave para este pedido?
  const { data: jaTem } = await sb.from("chaves").select("id, codigo").eq("pedido_id", pedidoId).maybeSingle();
  if (jaTem) { await marcarAprovado(sb, pedido.id, jaTem.id); return jaTem.codigo; }

  for (let i = 0; i < 6; i++) {
    const codigo = gerarCodigo();
    const { data, error } = await sb.from("chaves").insert({
      codigo,
      email: pedido.email,
      status: "ativa",
      pedido_id: pedido.id,
      valor_pago: pedido.valor,
      observacao: `Apoio no site · R$ ${pedido.valor}`,
    }).select("id, codigo").single();

    if (data) { await marcarAprovado(sb, pedido.id, data.id); return data.codigo; }

    // Insert falhou. Se foi corrida no mesmo pedido, a chave já está lá: usa ela.
    const { data: agora } = await sb.from("chaves").select("id, codigo").eq("pedido_id", pedidoId).maybeSingle();
    if (agora) { await marcarAprovado(sb, pedido.id, agora.id); return agora.codigo; }
    // Senão foi colisão de código (raríssima): tenta outro.
    if (error && !/duplicate|unique/i.test(error.message || "")) throw new Error("Falha ao gerar a chave");
  }
  throw new Error("Falha ao gerar a chave");
}

async function marcarAprovado(sb, pedidoId, chaveId) {
  await sb.from("pedidos")
    .update({ status: "aprovado", chave_id: chaveId, aprovado_em: new Date().toISOString() })
    .eq("id", pedidoId).neq("status", "aprovado");
}
