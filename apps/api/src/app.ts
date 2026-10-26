import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import { ordersRouter } from "./routes/orders.js";
import { toolsRouter } from "./routes/tools.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();

  const origin = process.env.CORS_ORIGIN?.split(",").map((value) => value.trim()) ?? true;

  app.use(cors({ origin, credentials: true }));
  // Audio webhooks carry a base64 MP3 of the whole call.
  app.use(express.json({ limit: "32mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "amanit-api" });
  });

  app.use("/auth", authRouter);
  app.use("/conversations", conversationsRouter);
  app.use("/orders", ordersRouter);
  app.use("/tools", toolsRouter);
  // Canonical: POST /api/elevenlabs/webhook
  app.use("/api", webhooksRouter);
  // Back-compat: POST /webhooks/conversations, /webhooks/elevenlabs, …
  app.use("/webhooks", webhooksRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
