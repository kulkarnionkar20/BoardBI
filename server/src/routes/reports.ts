import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { decrypt } from "../jira/crypto.js";
import { JiraError, searchAll } from "../jira/client.js";

const router = Router();

const LayoutItem = z.object({
  i: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  minW: z.number().int().positive().optional(),
  minH: z.number().int().positive().optional(),
});

const PageSlicer = z.object({
  id: z.string(),
  type: z.enum(["dateRange", "multiSelect", "singleSelect", "text"]),
  field: z.string(),
  label: z.string().optional(),
  value: z.unknown(),
});

const GadgetInput = z.object({
  id: z.string(),
  type: z.enum(["table", "bar", "pie", "line", "kpi"]),
  config: z.record(z.unknown()).default({}),
});

const CreateReport = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  connectionId: z.string().min(1),
  jql: z.string().default(""),
});

const UpdateReport = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  jql: z.string().optional(),
  layout: z.array(LayoutItem).optional(),
  pageSlicers: z.array(PageSlicer).optional(),
  gadgets: z.array(GadgetInput).optional(),
});

function shapeReport(r: {
  id: string;
  name: string;
  description: string | null;
  connectionId: string;
  jql: string;
  layout: string;
  pageSlicers: string;
  createdAt: Date;
  updatedAt: Date;
  gadgets?: Array<{ id: string; type: string; config: string; i: string }>;
}) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    connectionId: r.connectionId,
    jql: r.jql,
    layout: JSON.parse(r.layout) as unknown,
    pageSlicers: JSON.parse(r.pageSlicers) as unknown,
    gadgets:
      r.gadgets?.map((g) => ({
        id: g.id,
        type: g.type,
        config: JSON.parse(g.config) as unknown,
      })) ?? [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const items = await prisma.report.findMany({
    orderBy: { updatedAt: "desc" },
    include: { gadgets: true },
  });
  res.json(items.map(shapeReport));
});

router.get("/:id", async (req, res) => {
  const r = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { gadgets: true },
  });
  if (!r) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(shapeReport(r));
});

router.post("/", async (req, res) => {
  const parsed = CreateReport.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const conn = await prisma.jiraConnection.findUnique({
    where: { id: parsed.data.connectionId },
  });
  if (!conn) {
    res.status(400).json({ error: "Unknown connectionId" });
    return;
  }
  const created = await prisma.report.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      connectionId: parsed.data.connectionId,
      jql: parsed.data.jql,
    },
    include: { gadgets: true },
  });
  res.status(201).json(shapeReport(created));
});

router.patch("/:id", async (req, res) => {
  const parsed = UpdateReport.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const data: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.jql !== undefined) data.jql = parsed.data.jql;
  if (parsed.data.layout !== undefined) data.layout = JSON.stringify(parsed.data.layout);
  if (parsed.data.pageSlicers !== undefined)
    data.pageSlicers = JSON.stringify(parsed.data.pageSlicers);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.report.update({ where: { id: req.params.id }, data });
    if (parsed.data.gadgets) {
      await tx.gadget.deleteMany({ where: { reportId: req.params.id } });
      if (parsed.data.gadgets.length > 0) {
        await tx.gadget.createMany({
          data: parsed.data.gadgets.map((g) => ({
            id: g.id,
            i: g.id,
            reportId: req.params.id,
            type: g.type,
            config: JSON.stringify(g.config),
          })),
        });
      }
    }
    return tx.report.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { gadgets: true },
    });
  });
  res.json(shapeReport(updated));
});

router.delete("/:id", async (req, res) => {
  await prisma.report.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

router.post("/:id/data", async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { connection: true },
  });
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  if (!report.jql.trim()) {
    res.status(400).json({ error: "Report has no JQL configured" });
    return;
  }
  try {
    const result = await searchAll(
      {
        baseUrl: report.connection.baseUrl,
        email: report.connection.email,
        apiToken: decrypt(report.connection.apiToken),
      },
      report.jql,
    );
    const snapshot = await prisma.datasetSnapshot.create({
      data: {
        reportId: report.id,
        rowCount: result.rows.length,
        truncated: result.truncated,
        rows: JSON.stringify(result.rows),
      },
    });
    res.json({
      snapshotId: snapshot.id,
      fetchedAt: snapshot.fetchedAt.toISOString(),
      rowCount: snapshot.rowCount,
      truncated: snapshot.truncated,
      rows: result.rows,
    });
  } catch (err) {
    if (err instanceof JiraError) {
      res.status(502).json({
        error: `JIRA returned ${err.status}`,
        details: err.body,
      });
      return;
    }
    throw err;
  }
});

router.get("/:id/data/latest", async (req, res) => {
  const snap = await prisma.datasetSnapshot.findFirst({
    where: { reportId: req.params.id },
    orderBy: { fetchedAt: "desc" },
  });
  if (!snap) {
    res.status(404).json({ error: "No snapshot yet" });
    return;
  }
  res.json({
    snapshotId: snap.id,
    fetchedAt: snap.fetchedAt.toISOString(),
    rowCount: snap.rowCount,
    truncated: snap.truncated,
    rows: JSON.parse(snap.rows) as unknown,
  });
});

export default router;
