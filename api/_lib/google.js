// Confere o id_token que o jogo recebe do "Entrar com Google" (Credential Manager do Android), com a biblioteca oficial
// do Google: assinatura pelas chaves públicas do Google (baixadas e guardadas em cache pela própria biblioteca), emissor
// accounts.google.com, prazo e o PÚBLICO (aud) = o ID do cliente OAuth "Aplicativo da Web" do projeto no Google Cloud.
//
// GOOGLE_CLIENT_ID: esse ID (o mesmo que o jogo passa como serverClientId). Aceita vários separados por vírgula
// (trocar de cliente sem derrubar quem está no meio do login).
import { OAuth2Client } from "google-auth-library";

let cliente;

export function idsDoCliente() {
  return (process.env.GOOGLE_CLIENT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export const googleDisponivel = () => idsDoCliente().length > 0;

// A biblioteca recusa o token lançando Error com a frase do motivo; quem falha na REDE (baixar as chaves públicas)
// lança o erro do gaxios. Os dois casos viram respostas diferentes (401 × 503).
function falhaDeRede(e) {
  return e?.name === "GaxiosError" || !!e?.response || /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket/i.test(e?.message || "");
}

// -> { ok: true, googleId, email, nome }  |  { ok: false, motivo }   (lança só em falha de rede/configuração)
export async function conferirTokenDoGoogle(idToken) {
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 4096 || idToken.split(".").length !== 3)
    return { ok: false, motivo: "formato" };
  const ids = idsDoCliente();
  // Sem público a biblioteca NÃO confere o aud: aceitaria o token de qualquer app. Nunca seguir sem ele.
  if (!ids.length) throw new Error("GOOGLE_CLIENT_ID ausente no ambiente");
  if (!cliente) cliente = new OAuth2Client();

  let carga;
  try {
    const ticket = await cliente.verifyIdToken({ idToken, audience: ids });
    carga = ticket.getPayload();
  } catch (e) {
    if (falhaDeRede(e)) throw e;
    // A frase da biblioteca traz o token inteiro: no log vai só o começo do motivo.
    return { ok: false, motivo: String(e?.message || "recusado").slice(0, 60) };
  }
  if (!carga?.sub) return { ok: false, motivo: "sem sub" };
  return {
    ok: true,
    googleId: String(carga.sub),
    // E-mail não confirmado pelo Google não vai para o banco (é só informativo, mas não pode enganar o painel).
    email: carga.email && carga.email_verified !== false ? String(carga.email).slice(0, 200) : null,
    nome: carga.name ? String(carga.name).slice(0, 80) : null,
  };
}
