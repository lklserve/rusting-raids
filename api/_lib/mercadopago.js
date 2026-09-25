// Mercado Pago — cobrança Pix e conferência de pagamento.
// O token vive SÓ em variável de ambiente (MERCADO_PAGO_ACCESS_TOKEN), nunca no código.
import crypto from "node:crypto";

const MP_API = "https://api.mercadopago.com/v1/payments";

export async function criarPix({ valor, email, descricao, pedidoId, notificationUrl }) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN ausente");
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

  const r = await fetch(MP_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Idempotência: se a rede repetir o POST, o Mercado Pago não cria duas cobranças.
      "X-Idempotency-Key": pedidoId,
    },
    body: JSON.stringify({
      transaction_amount: Number(valor),
      // Sem "currency_id": a API de pagamentos recusa esse campo e já assume BRL pela conta.
      description: descricao,
      payment_method_id: "pix",
      external_reference: pedidoId,
      date_of_expiration: expiraEm.toISOString(),
      payer: { email },
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
    }),
  });

  if (!r.ok) {
    console.error("Mercado Pago criar erro", r.status, await r.text().catch(() => ""));
    throw new Error("Não foi possível gerar o Pix agora. Tente de novo.");
  }
  const p = await r.json();
  const d = p.point_of_interaction?.transaction_data;
  return {
    paymentId: String(p.id),
    qrBase64: d?.qr_code_base64 ?? null,
    copiaCola: d?.qr_code ?? "",
    expiraEm: expiraEm.toISOString(),
  };
}

// Pergunta ao próprio Mercado Pago se o pagamento está aprovado.
// É isto que impede forjar um webhook: a chave só sai se a MP confirmar o pagamento.
export async function consultarPagamento(paymentId) {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return null;
  const r = await fetch(`${MP_API}/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// Confere a assinatura do webhook (cabeçalho x-signature), quando há segredo configurado.
// Sem o segredo, devolve true e a segurança fica por conta do consultarPagamento acima.
export function assinaturaValida(req, dataId) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  try {
    const sig = String(req.headers["x-signature"] || "");
    const reqId = String(req.headers["x-request-id"] || "");
    const partes = Object.fromEntries(
      sig.split(",").map((p) => p.split("=").map((s) => s.trim())),
    );
    if (!partes.ts || !partes.v1) return false;
    const manifest = `id:${String(dataId).toLowerCase()};request-id:${reqId};ts:${partes.ts};`;
    const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    const a = Buffer.from(esperado);
    const b = Buffer.from(partes.v1);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
