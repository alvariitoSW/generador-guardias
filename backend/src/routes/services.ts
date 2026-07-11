import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prismaClient";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const services = await prisma.service.findMany({
    include: { posts: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
  return res.json(services);
});

const createServiceSchema = z.object({
  name: z.string().min(1),
  posts: z
    .array(z.object({ name: z.string().min(1), slotsPerDay: z.number().int().min(1).max(10).default(2) }))
    .default([]),
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, posts } = parsed.data;

  const service = await prisma.service.create({
    data: {
      name,
      posts: {
        create: posts.map((p, i) => ({ name: p.name, slotsPerDay: p.slotsPerDay, order: i })),
      },
    },
    include: { posts: true },
  });
  return res.status(201).json(service);
});

const addPostSchema = z.object({
  name: z.string().min(1),
  slotsPerDay: z.number().int().min(1).max(10).default(2),
});

router.post("/:serviceId/posts", requireAuth, requireAdmin, async (req, res) => {
  const parsed = addPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const count = await prisma.post.count({ where: { serviceId: String(req.params.serviceId) } });
  const post = await prisma.post.create({
    data: { ...parsed.data, serviceId: String(req.params.serviceId), order: count },
  });
  return res.status(201).json(post);
});

export default router;
