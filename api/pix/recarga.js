// POST /api/pix/recarga  { chave, pacote, email }  ->  { pedidoId, valor, cupons, qrBase64, copiaECola, expiraEm }
// Pix de recarga de cupons para uma chave. O navegador manda só o ID do pacote: preço e cupons saem da
// tabela loja_pacotes. Antes de cobrar, confere se a chave existe e não está banida.
import { cabecalhos, ipDe, emailValido, normalizarCodigo, texto } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { criarPix } from "../_lib/mercadopago.js";
import { limitar } from "../_lib/rate-limit.js";

export default async function handler(req, res) {
  if (cabecalhos(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido" });

  try {
    const corpo = req.body || {};
    const codigo = normalizarCodigo(corpo.chave);
    const pacoteId = texto(corpo.pacote, 16);
    const email = String(corpo.email || "").trim().toLowerCase();

    if (!codigo) return res.status(400).json({ erro: "Digite uma chave válida (RR-XXXX-XXXX)." });
    if (!pacoteId) return res.status(400).json({ erro: "Escolha um pacote." });
    if (!emailValido(email)) return res.status(400).json({ erro: "Digite um e-mail válido." });

    const okIp = await limitar(`recarga:ip:${ipDe(req)}`, 20, 600);
    const okChave = await limitar(`recarga:chave:${codigo}`, 8, 600);
    if (!okIp || !okChave) return res.status(429).json({ erro: "Muitas tentativas. Espere alguns minutos." });

    const sb = supabase();
    const { data: chave } = await sb.from("chaves").select("id, status").eq("codigo", codigo).maybeSingle();
    if (!chave) return res.status(404).json({ erro: "Chave não encontrada. Confira as letras e os números." });
    if (chave.status === "banida") return res.status(403).json({ erro: "Esta chave foi banida e não pode receber cupons." });

    const { data: pacote } = await sb.from("loja_pacotes").select("id, reais, cupons, bonus").eq("id", pacoteId).eq("ativo", true).maybeSingle();
    if (!pacote) return res.status(400).json({ erro: "Pacote indisponível." });
    const valor = Number(pacote.reais);
    const cupons = pacote.cupons + pacote.bonus;

    const { data: pedido, error } = await sb.from("pedidos")
      .insert({ email, valor, status: "pendente", tipo: "recarga", recarga_chave_id: chave.id, pacote_id: pacote.id, cupons })
      .select("id").single();
    if (error || !pedido) throw new Error("Falha ao criar o pedido");

    const host = process.env.SITE_URL || (req.headers.host ? `https://${req.headers.host}` : null);
    const cobranca = await criarPix({
      valor, email,
      descricao: `Rusting Raids — recarga de ${cupons} cupons`,
      pedidoId: pedido.id,
      notificationUrl: host ? `${host}/api/webhooks/mercadopago` : undefined,
    });

    await sb.from("pedidos").update({
      payment_id: cobranca.paymentId,
      pix_qr_base64: cobranca.qrBase64,
      pix_copia_cola: cobranca.copiaCola,
      expira_em: cobranca.expiraEm,
    }).eq("id", pedido.id);

    return res.status(200).json({
      pedidoId: pedido.id, valor, cupons,
      qrBase64: cobranca.qrBase64, copiaECola: cobranca.copiaCola, expiraEm: cobranca.expiraEm,
    });
  } catch (e) {
    console.error("pix/recarga", e);
    return res.status(500).json({ erro: "Erro ao gerar o Pix da recarga." });
  }
}
