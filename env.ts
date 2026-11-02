import { env } from "cloudflare:workers";

export type SillynEnv = {
  DB: D1Database;
  FILES: R2Bucket;
};

export const bindings = env as unknown as SillynEnv;
