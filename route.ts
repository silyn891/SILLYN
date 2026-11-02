import { verifyUser } from "@/src/lib/auth";
import { cleanText, json, readJson } from "@/src/lib/http";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ email: string; password: string }>(request);
    const email = cleanText(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return json({ error: "Inserisci email e password." }, 400);
    const auth = await verifyUser(email, password);
    if (!auth) return json({ error: "Email o password non corretti." }, 401);
    return json({ user: auth.user }, 200, { "set-cookie": auth.cookie });
  } catch {
    return json({ error: "Accesso non riuscito. Riprova." }, 500);
  }
}
