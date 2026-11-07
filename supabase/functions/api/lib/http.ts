export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-beseen-device, x-client-info, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function requireString(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${name} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${name} is too long`);
  return trimmed;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, name: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new HttpError(400, `${name} must be a UUID`);
  return value.toLowerCase();
}
