const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function apiRequest(
  path,
  { token, signal, body, method = "GET", blob = false } = {},
) {
  const response = await fetch(API_URL + path, {
    method,
    credentials: "include",
    signal,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-IATECH-CSRF": "1" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (blob && response.ok) return response.blob();
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      Array.isArray(data?.message)
        ? data.message.join(". ")
        : (data?.message ?? "No se pudo completar la solicitud"),
      response.status,
    );
  return data;
}
export const login = (correo, contrasena) =>
  apiRequest("/auth/login", { method: "POST", body: { correo, contrasena } });
export const currentSession = (token) => apiRequest("/auth/me", { token });
export const closeSession = () =>
  apiRequest("/auth/logout", { method: "POST" });
const normalizeArea = (area) => (area === "big-data" ? "bigdata" : area);
export const inventoryMetadata = (area, token, signal) =>
  apiRequest("/inventarios/" + normalizeArea(area) + "/metadatos", {
    token,
    signal,
  });
export function queryString(query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "")
      params.set(
        key,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  return params.toString();
}
export const inventoryList = (area, token, query, signal) =>
  apiRequest("/inventarios/" + normalizeArea(area) + "?" + queryString(query), {
    token,
    signal,
  });
export const saveInventory = (area, token, body, id) =>
  apiRequest(
    "/inventarios/" + normalizeArea(area) + (id === undefined ? "" : "/" + id),
    { token, method: id === undefined ? "POST" : "PATCH", body },
  );
export const inventoryReport = (area, token, query, signal) =>
  apiRequest("/reportes/" + normalizeArea(area), {
    token,
    method: "POST",
    body: query,
    signal,
  });
export const inventoryExport = (area, token, query) =>
  apiRequest("/bi/" + normalizeArea(area) + "/exportar?" + queryString(query), {
    token,
    blob: true,
  });
export async function listActivos(area, token, search = "", page = 1, signal) {
  return apiRequest(
    "/activos/" +
      normalizeArea(area) +
      "?" +
      queryString({ q: search, page, pageSize: 20 }),
    { token, signal },
  );
}
export async function listSecurityActivity(token, filters, signal) {
  return apiRequest("/seguridad/actividad?" + queryString(filters), {
    token,
    signal,
  });
}
