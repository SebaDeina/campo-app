export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Llamada a la API propia. Los pedidos que modifican llevan X-Requested-With
// (el servidor los rechaza sin ese header, como protección CSRF).
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-Requested-With'] = 'campo';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText, data?.code);
  return data;
}
