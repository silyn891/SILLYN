export function json(data: unknown, status = 200, headers?: HeadersInit) {
  const result = new Headers(headers);
  result.set("content-type", "application/json; charset=utf-8");
  result.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: result });
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try { return await request.json() as T; }
  catch { throw new Error("Corpo della richiesta non valido."); }
}

export function cleanText(value: unknown, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
