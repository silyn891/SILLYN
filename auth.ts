import { bindings } from "@/src/lib/env";

const COOKIE = "sillyn_session";
const ITERATIONS = 210_000;
const enc = new TextEncoder();

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function digest(value: string) {
  return toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));
}
function constantTimeEqual(a: string, b: string) {
  const aa = enc.encode(a), bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}
async function derive(password: string, salt: string, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations }, material, 256);
  return toBase64(new Uint8Array(bits));
}
function randomToken() {
  return toBase64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const pair = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE.length + 1)) : null;
}

export type User = { id: string; email: string; name: string };
export type AuthResult = { user: User; sessionId: string; cookie: string };

export async function createUser(email: string, name: string, password: string): Promise<AuthResult> {
  const id = crypto.randomUUID();
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derive(password, salt);
  await bindings.DB.prepare(
    "INSERT INTO users (id,email,name,password_hash,password_salt,password_iterations) VALUES (?,?,?,?,?,?)"
  ).bind(id, email.toLowerCase(), name, hash, salt, ITERATIONS).run();

  const personalId = crypto.randomUUID();
  const businessId = crypto.randomUUID();
  await bindings.DB.batch([
    bindings.DB.prepare("INSERT INTO workspaces (id,name,type,owner_id) VALUES (?,?,?,?)").bind(personalId, "Personale", "personal", id),
    bindings.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)").bind(personalId, id, "owner"),
    bindings.DB.prepare("INSERT INTO workspaces (id,name,type,owner_id) VALUES (?,?,?,?)").bind(businessId, "Business", "business", id),
    bindings.DB.prepare("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES (?,?,?)").bind(businessId, id, "owner")
  ]);
  return createSession({ id, email: email.toLowerCase(), name });
}

export async function verifyUser(email: string, password: string): Promise<AuthResult | null> {
  const row = await bindings.DB.prepare(
    "SELECT id,email,name,password_hash,password_salt,password_iterations FROM users WHERE email = ? COLLATE NOCASE"
  ).bind(email.toLowerCase()).first<any>();
  if (!row) return null;
  const candidate = await derive(password, row.password_salt, row.password_iterations);
  if (!constantTimeEqual(candidate, row.password_hash)) return null;
  return createSession({ id: row.id, email: row.email, name: row.name });
}

export async function createSession(user: User): Promise<AuthResult> {
  const token = randomToken();
  const tokenHash = await digest(token);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const sessionId = crypto.randomUUID();
  await bindings.DB.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,?)")
    .bind(sessionId, user.id, tokenHash, expires).run();
  const cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
  return { user, sessionId, cookie };
}

export async function getUser(request: Request): Promise<User | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await bindings.DB.prepare(
    `SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at > datetime('now') LIMIT 1`
  ).bind(tokenHash).first<User>();
  return row || null;
}

export async function destroySession(request: Request) {
  const token = cookieValue(request);
  if (token) await bindings.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "Accedi per continuare." }), { status: 401, headers: { "content-type": "application/json" } });
  return user;
}

export async function workspaceRole(userId: string, workspaceId: string) {
  return bindings.DB.prepare("SELECT role FROM workspace_members WHERE user_id=? AND workspace_id=?")
    .bind(userId, workspaceId).first<{ role: string }>();
}

export async function canWrite(userId: string, workspaceId: string) {
  const member = await workspaceRole(userId, workspaceId);
  return !!member && ["owner", "admin", "member"].includes(member.role);
}
