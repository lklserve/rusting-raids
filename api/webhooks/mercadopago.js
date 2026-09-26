// POST /api/webhooks/mercadopago  — aviso do Mercado Pago quando um pagamento muda.
// Emite a chave (apoio) ou credita os cupons (recarga). NUNCA confia no corpo: pergunta à MP se o pagamento está mesmo aprovado
// (por isso um webhook falso não consegue liberar chave). Responde sempre 200: se der erro,
// a MP reenvia e a consulta de status ainda emite a chave.
import { consultarPagamento, assinaturaValida } from "../_lib/mercadopago.js";
import { processarAprovado } from "../_lib/emitir.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const corpo = req.body || {};
    const tipo = corpo.type || corpo.topic || req.query?.type;
    const paymentId = corpo.data?.id || req.query?.["data.id"] || req.query?.id;

    if (tipo && tipo !== "payment") return res.status(200).json({ ok: true });
    if (!paymentId) return res.status(200).json({ ok: true });
    if (!assinaturaValida(req, paymentId)) {
      console.warn("webhook com assinatura inválida");
      return res.status(200).json({ ok: true });
    }

    const pag = await consultarPagamento(paymentId);
    if (pag?.status === "approved" && pag.external_reference) {
      await processarAprovado(pag.external_reference);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook", e);
    return res.status(200).json({ ok: true });
  }
}
