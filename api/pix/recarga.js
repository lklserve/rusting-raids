// POST /api/pix/recarga  { chave, pacote, valor?, email, aceite? }  ->  { pedidoId, valor, cupons, emDobro, qrBase64, copiaECola, expiraEm }
// "aceite" = a versão dos Termos que a pessoa marcou (fica no pedido como prova; _lib/pedido.js).
// Pix de recarga de cupons para uma chave. O navegador manda só o ID do pacote: preço e cupons saem da
// tabela loja_pacotes. Antes de cobrar, confere se a chave existe e não está banida.
// VALOR LIVRE (29/10): pacote "livre" + valor em reais inteiros (R$ 5 a R$ 500); os cupons saem da conta do
// _lib/recarga.js (20 por real + o bônus de 5% a 80%), nunca do navegador. O pedido fica com pacote_id "livre".
// A RECARGA EM DOBRO (supabase/recarga_em_dobro.sql): se a chave ainda não ganhou o dobro, "cupons" já vem dobrado
// e emDobro = true. O pedido guarda os cupons do pacote; o dobro é dado pelo banco na hora do crédito (uma vez só).
import { cabecalhos, ipDe, emailValido, normalizarCodigo, texto } from "../_lib/http.js";
import { supabase } from "../_lib/supabase.js";
import { criarPix } from "../_lib/mercadopago.js";
import { limitar } from "../_lib/rate-limit.js";
import { recargaEmDobro, RECARGA_LIVRE, bonusDaRecarga, valorLivre } from "../_lib/recarga.js";
import { inserirPedido } from "../_lib/pedido.js";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
    const livre = pacoteId === "livre";
    const reaisLivres = livre ? valorLivre(corpo.valor) : null;
    if (livre && reaisLivres === null)
      return res.status(400).json({ erro: `Digite um valor em reais inteiros, de ${brl.format(RECARGA_LIVRE.minimo)} a ${brl.format(RECARGA_LIVRE.maximo)}.` });
    if (!emailValido(email)) return res.status(400).json({ erro: "Digite um e-mail válido." });

    const okIp = await limitar(`recarga:ip:${ipDe(req)}`, 20, 600);
    const okChave = await limitar(`recarga:chave:${codigo}`, 8, 600);
    if (!okIp || !okChave) return res.status(429).json({ erro: "Muitas tentativas. Espere alguns minutos." });

    const sb = supabase();
    const { data: chave } = await sb.from("chaves").select("id, status").eq("codigo", codigo).maybeSingle();
    if (!chave) return res.status(404).json({ erro: "Chave não encontrada. Confira as letras e os números." });
    if (chave.status === "banida") return res.status(403).json({ erro: "Esta chave foi banida e não pode receber cupons." });

    let pacote;
    if (livre) {
      pacote = { id: "livre", reais: reaisLivres, cupons: reaisLivres * RECARGA_LIVRE.cuponsPorReal, bonus: bonusDaRecarga(reaisLivres) };
    } else {
      ({ data: pacote } = await sb.from("loja_pacotes").select("id, reais, cupons, bonus").eq("id", pacoteId).eq("ativo", true).maybeSingle());
      if (!pacote) return res.status(400).json({ erro: "Pacote indisponível." });
    }
    const valor = Number(pacote.reais);
    const cupons = pacote.cupons + pacote.bonus;
    const emDobro = await recargaEmDobro(sb, chave.id);
    const vaiReceber = emDobro ? cupons * 2 : cupons;

    const { data: pedido, error } = await inserirPedido(sb,
      { email, valor, status: "pendente", tipo: "recarga", recarga_chave_id: chave.id, pacote_id: pacote.id, cupons }, corpo.aceite);
    if (error || !pedido) throw new Error("Falha ao criar o pedido");

    const host = process.env.SITE_URL || (req.headers.host ? `https://${req.headers.host}` : null);
    let cobranca;
    try {
      cobranca = await criarPix({
        valor, email,
        descricao: (emDobro ? `Rusting Raids — recarga de ${cupons} cupons (em dobro: ${vaiReceber})`
                            : `Rusting Raids — recarga de ${cupons} cupons`) + (livre ? ` (${pacote.bonus} de bônus)` : ""),
        pedidoId: pedido.id,
        notificationUrl: host ? `${host}/api/webhooks/mercadopago` : undefined,
      });
    } catch (e) {
      // Sem cobrança, o pedido não fica pendente para sempre no painel.
      await sb.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id).eq("status", "pendente");
      console.error("pix/recarga Mercado Pago", e);
      return res.status(502).json({ erro: "O Mercado Pago recusou o Pix. Confira o e-mail (use um e-mail de verdade) e tente de novo." });
    }

    await sb.from("pedidos").update({
      payment_id: cobranca.paymentId,
      pix_qr_base64: cobranca.qrBase64,
      pix_copia_cola: cobranca.copiaCola,
      expira_em: cobranca.expiraEm,
    }).eq("id", pedido.id);

    return res.status(200).json({
      pedidoId: pedido.id, valor, cupons: vaiReceber, emDobro,
      qrBase64: cobranca.qrBase64, copiaECola: cobranca.copiaCola, expiraEm: cobranca.expiraEm,
    });
  } catch (e) {
    console.error("pix/recarga", e);
    return res.status(500).json({ erro: "Erro ao gerar o Pix da recarga." });
  }
}
