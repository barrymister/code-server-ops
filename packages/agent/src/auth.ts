import type { FastifyInstance } from "fastify";
import basicAuthPlugin from "@fastify/basic-auth";

const AUTH_EXEMPT_ROUTES = new Set<string>(["/health", "/metrics"]);

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
    const route = req.routeOptions.url ?? req.url;
    if (AUTH_EXEMPT_ROUTES.has(route)) {
      done();
      return;
    }
    app.basicAuth(req, reply, done);
  });
}
