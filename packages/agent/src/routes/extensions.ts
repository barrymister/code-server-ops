import type { FastifyInstance } from "fastify";
import { collectExtensions } from "../collectors/extensions.js";

export async function extensionsRoute(app: FastifyInstance): Promise<void> {
  app.get("/extensions", async () => collectExtensions());
}
