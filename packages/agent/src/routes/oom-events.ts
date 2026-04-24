import type { FastifyInstance } from "fastify";
import { collectOomEvents } from "../collectors/journalctl.js";

export async function oomEventsRoute(app: FastifyInstance): Promise<void> {
  app.get("/oom-events", async (req) => {
    const q = req.query as { window?: string } | undefined;
    const windowSecs = q?.window ? Math.max(60, Number.parseInt(q.window, 10)) : 7 * 24 * 3600;
    return collectOomEvents(windowSecs);
  });
}
