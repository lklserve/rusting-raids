// GET /api/pix/status?pedido=UUID  ->  { status: "pendente"|"aprovado"|"expirado", chave? }
// A tela pergunta de 4 em 4 s. Se o webhook não chegou, aqui perguntamos direto ao
// Mercado Pago — assim o apoiador nunca fica preso no QR depois de pagar.
import { cabecalhos } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { consultarPagamento } from "../_lib/mercadopago.js";
import { emitirChave, processarAprovado } from "../_lib/emitir.js";

// UUID v4 solto não se adivinha; ainda assim, só o dono (o navegador que criou) tem o id.
const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || "");

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  const pedidoId = req.query?.pedido;
  if (!uuidOk(pedidoId)) return res.status(200).json({ status: "pendente" });

  try {
    const sb = supabase();
    const { data: pedido } = await sb.from("pedidos").select("*").eq("id", pedidoId).maybeSingle();
    if (!pedido) return res.status(200).json({ status: "pendente" });

    // Recarga de cupons: { status, tipo: "recarga", cupons, saldo } — sem chave nova.
    if (pedido.tipo === "recarga") {
      if (pedido.status === "expirado" || pedido.status === "cancelado") return res.status(200).json({ status: "expirado" });
      if (pedido.status === "aprovado" || (pedido.payment_id && (await consultarPagamento(pedido.payment_id))?.status === "approved")) {
        const r = await processarAprovado(pedido.id);
        return res.status(200).json({ status: "aprovado", tipo: "recarga", cupons: r.cupons, saldo: r.saldo });
      }
      if (pedido.expira_em && new Date(pedido.expira_em) < new Date()) {
        await sb.from("pedidos").update({ status: "expirado" }).eq("id", pedido.id).eq("status", "pendente");
        return res.status(200).json({ status: "expirado" });
      }
      return res.status(200).json({ status: "pendente" });
    }

    if (pedido.status === "aprovado" && pedido.chave_id) {
      const { data: chave } = await sb.from("chaves").select("codigo").eq("id", pedido.chave_id).maybeSingle();
      return res.status(200).json({ status: "aprovado", chave: chave?.codigo ?? null });
    }
    if (pedido.status === "expirado" || pedido.status === "cancelado")
      return res.status(200).json({ status: "expirado" });

    // Rede de segurança: confirma no Mercado Pago.
    if (pedido.payment_id) {
      const pag = await consultarPagamento(pedido.payment_id);
      if (pag?.status === "approved") {
        const codigo = await emitirChave(pedido.id);
        return res.status(200).json({ status: "aprovado", chave: codigo });
      }
    }

    // Passou do prazo sem pagar: marca como expirado.
    if (pedido.expira_em && new Date(pedido.expira_em) < new Date()) {
      await sb.from("pedidos").update({ status: "expirado" }).eq("id", pedido.id).eq("status", "pendente");
      return res.status(200).json({ status: "expirado" });
    }

    return res.status(200).json({ status: "pendente" });
  } catch (e) {
    console.error("pix/status", e);
    // Nunca vira erro na tela: o modal trata isso como "segue tentando".
    return res.status(200).json({ status: "pendente" });
  }
}
