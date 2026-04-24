import type { FastifyInstance } from "fastify";
import basicAuthPlugin from "@fastify/basic-auth";

// Prefix-based auth: any request whose path starts with one of these roots
// requires basic-auth. Everything else (health, metrics, UI static assets)
// is served without auth.
const PROTECTED_PREFIXES = [
  "/terminals",
  "/extensions",
  "/ai-processes",
  "/memory",
  "/oom-events",
];

export async function registerAuth(app: FastifyInstance): Promise<void> {
  const password = process.env.CSOPS_PASSWORD;
  if (!password) {
    throw new Error(
      "CSOPS_PASSWORD env var is required. Set it to a strong secret before starting the agent.",
    );
  }

  await app.register(basicAuthPlugin, {
    validate: async (_username, pw) => {
      if (pw !== password) {
        throw new Error("Invalid credentials");
      }
    },
    authenticate: { realm: "code-server-ops" },
  });

  app.addHook("preHandler", (req, reply, done) => {
    const url = req.url.split("?")[0] ?? "";
    const protectedPath = PROTECTED_PREFIXES.some(
      (p) => url === p || url.startsWith(`${p}/`),
    );
    if (!protectedPath) {
      done();
      return;
    }
    app.basicAuth(req, reply, done);
  });
}
