import { Router } from "express";
import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  priceCents: z.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  conversationId: z.string().optional(),
  externalId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  tableLabel: z.string().optional(),
  language: z.string().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
});

const updateSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  tableLabel: z.string().optional(),
  language: z.string().optional(),
  items: z.array(itemSchema).min(1).optional(),
  notes: z.string().nullable().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  conversationId: z.string().nullable().optional(),
});

function computeTotal(
  items: Array<{ quantity: number; priceCents: number }>,
  totalCents?: number
) {
  if (typeof totalCents === "number") return totalCents;
  return items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
}

ordersRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as OrderStatus } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      conversation: {
        select: {
          id: true,
          externalId: true,
          summary: true,
          callerName: true,
          tableLabel: true,
        },
      },
    },
  });
  return res.json({ orders });
});

ordersRouter.get("/:id", async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { conversation: true },
  });
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  return res.json({ order });
});

ordersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const order = await prisma.order.create({
    data: {
      conversationId: data.conversationId,
      externalId: data.externalId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      tableLabel: data.tableLabel,
      language: data.language,
      items: data.items,
      notes: data.notes,
      totalCents: computeTotal(data.items, data.totalCents),
      status: data.status ?? OrderStatus.PENDING,
    },
  });

  return res.status(201).json({ order });
});

ordersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    return res.status(404).json({ error: "Order not found" });
  }

  const data = parsed.data;
  const items = data.items ?? (existing.items as Array<{ quantity: number; priceCents: number }>);

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      tableLabel: data.tableLabel,
      language: data.language,
      items: data.items,
      notes: data.notes === undefined ? undefined : data.notes,
      totalCents:
        data.items || data.totalCents !== undefined
          ? computeTotal(items, data.totalCents)
          : undefined,
      status: data.status,
      conversationId: data.conversationId === undefined ? undefined : data.conversationId,
    },
  });

  return res.json({ order });
});
