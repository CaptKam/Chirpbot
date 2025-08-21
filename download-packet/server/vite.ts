import { createServer } from "vite";
import type express from "express";

export async function createViteDevServer(app: express.Application) {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.ssrFixStacktrace);
  app.use(vite.middlewares);
}