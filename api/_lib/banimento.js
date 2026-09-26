// Ban por APARELHO (pedido do Ronni, 2026-09-26): um aparelho com qualquer jogador banido fica banido,
// com qualquer chave — senão o banido compra outra chave e volta a jogar no mesmo celular.
// O painel já bane os jogadores ao banir a chave (e libera ao desbanir), então basta olhar a tabela jogadores.

// Id genérico que a Unity devolve quando o aparelho não informa o dele (SystemInfo.unsupportedIdentifier):
// não entra no ban por aparelho, senão um ban pegaria todo mundo sem id.
const GENERICOS = new Set(["n/a", "unknown", "unsupported", "null", "undefined"]);

export function aparelhoConfiavel(deviceId) {
  return typeof deviceId === "string" && deviceId.length >= 8 && !GENERICOS.has(deviceId.toLowerCase());
}

// -> { motivo } se o aparelho tem jogador banido; null se não tem (ou se o id não é confiável).
export async function banDoAparelho(sb, deviceId) {
  if (!aparelhoConfiavel(deviceId)) return null;
  const { data, error } = await sb.from("jogadores")
    .select("motivo_ban").eq("device_id", deviceId).eq("banido", true).limit(1);
  if (error) throw error;
  return data && data.length ? { motivo: data[0].motivo_ban || "Banido pelo administrador." } : null;
}
