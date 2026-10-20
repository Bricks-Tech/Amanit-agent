import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.get("/", async (_req, res) => {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      orders: {
        select: {
          id: true,
          status: true,
          totalCents: true,
          externalId: true,
          items: true,
        },
      },
    },
  });
  return res.json({ conversations });
});

conversationsRouter.get("/:id", async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { orders: true },
  });
  if (!conversation) {
    return res.status(404).json({ error: "Conversation not found" });
  }
  return res.json({ conversation });
});

const createSchema = z.object({
  externalId: z.string().optional(),
  agentId: z.string().optional(),
  callerName: z.string().optional(),
  callerPhone: z.string().optional(),
  tableLabel: z.string().optional(),
  language: z.string().optional(),
  summary: z.string().optional(),
  transcript: z.string().optional(),
  status: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  metadata: z.unknown().optional(),
});

conversationsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const conversation = await prisma.conversation.create({
    data: {
      externalId: data.externalId,
      agentId: data.agentId,
      callerName: data.callerName,
      callerPhone: data.callerPhone,
      tableLabel: data.tableLabel,
      language: data.language,
      summary: data.summary,
      transcript: data.transcript,
      status: data.status ?? "completed",
      durationSeconds: data.durationSeconds,
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      metadata: data.metadata as object | undefined,
    },
  });

  return res.status(201).json({ conversation });
});
