// POST /api/pix/criar  { valor, email, aceite? }  ->  { pedidoId, valor, qrBase64, copiaECola, expiraEm }
// Cria o pedido e a cobrança Pix no Mercado Pago. O VALOR é validado no servidor:
// o navegador não decide preço (mínimo R$ 5, máximo R$ 100). "aceite" = a versão dos Termos que a pessoa marcou
// (fica no pedido como prova; _lib/pedido.js).
import { cabecalhos, ipDe, emailValido } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { criarPix } from "../_lib/mercadopago.js";
import { limitar } from "../_lib/rate-limit.js";
import { inserirPedido } from "../_lib/pedido.js";

const MIN = 5;
const MAX = 100;

// Lançamento aberto (27/10, o Ronni: "remova a obrigatoriedade de digitar uma Key ... remova a seção de Apoiadores"):
// o jogo não vende mais chave — entra-se com a conta Google. Esta rota fica respondendo 410 para página antiga em cache;
// a recarga de cupons (/api/pix/recarga) continua. O código de baixo fica para o histórico dos pedidos.
const VENDA_DE_CHAVE_ENCERRADA = true;

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });
  if (VENDA_DE_CHAVE_ENCERRADA)
    return res.status(410).json({ erro: "O jogo agora é aberto: baixe e entre com a sua conta Google. Cupons: pela recarga dentro do jogo." });

  try {
    const corpo = req.body || {};
    const email = String(corpo.email || "").trim().toLowerCase();
    const valor = Math.round(Number(corpo.valor));

    if (!emailValido(email)) return res.status(400).json({ erro: "Digite um e-mail válido." });
    if (!Number.isFinite(valor) || valor < MIN || valor > MAX)
      return res.status(400).json({ erro: `O valor deve ser entre R$ ${MIN} e R$ ${MAX}.` });

    // Limite por e-mail e por IP (barra laço automatizado sem atrapalhar quem compra).
    const okEmail = await limitar(`pix:email:${email}`, 8, 600);
    const okIp = await limitar(`pix:ip:${ipDe(req)}`, 20, 600);
    if (!okEmail || !okIp)
      return res.status(429).json({ erro: "Muitas tentativas. Espere alguns minutos." });

    const sb = supabase();
    const { data: pedido, error } = await inserirPedido(sb, { email, valor, status: "pendente" }, corpo.aceite);
    if (error || !pedido) throw new Error("Falha ao criar o pedido");

    const host = process.env.SITE_URL || (req.headers.host ? `https://${req.headers.host}` : null);
    const notificationUrl = host ? `${host}/api/webhooks/mercadopago` : undefined;

    const cobranca = await criarPix({
      valor, email,
      descricao: "Rusting Raids — apoio ao servidor",
      pedidoId: pedido.id,
      notificationUrl,
    });

    await sb.from("pedidos").update({
      payment_id: cobranca.paymentId,
      pix_qr_base64: cobranca.qrBase64,
      pix_copia_cola: cobranca.copiaCola,
      expira_em: cobranca.expiraEm,
    }).eq("id", pedido.id);

    return res.status(200).json({
      pedidoId: pedido.id,
      valor,
      qrBase64: cobranca.qrBase64,
      copiaECola: cobranca.copiaCola,
      expiraEm: cobranca.expiraEm,
    });
  } catch (e) {
    console.error("pix/criar", e);
    return res.status(500).json({ erro: e.message || "Erro ao gerar o Pix." });
  }
}
