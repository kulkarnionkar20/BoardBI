import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { encrypt, decrypt } from "../jira/crypto.js";
import { getMyself, JiraError, validateJql } from "../jira/client.js";

const router = Router();

const CreateInput = z.object({
  name: z.string().min(1).max(120),
  baseUrl: z.string().url(),
  email: z.string().email(),
  apiToken: z.string().min(1),
});

function publicShape(c: {
  id: string;
  name: string;
  baseUrl: string;
  email: string;
  createdAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl,
    email: c.email,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const items = await prisma.jiraConnection.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(items.map(publicShape));
});

router.post("/", async (req, res) => {
  const parsed = CreateInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const { name, baseUrl, email, apiToken } = parsed.data;
  const created = await prisma.jiraConnection.create({
    data: {
      name,
      baseUrl: baseUrl.replace(/\/$/, ""),
      email,
      apiToken: encrypt(apiToken),
    },
  });
  res.status(201).json(publicShape(created));
});

router.delete("/:id", async (req, res) => {
  await prisma.jiraConnection.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

router.post("/:id/test", async (req, res) => {
  const c = await prisma.jiraConnection.findUnique({ where: { id: req.params.id } });
  if (!c) {
    res.status(404).json({ ok: false, error: "Connection not found" });
    return;
  }
  try {
    const me = await getMyself({
      baseUrl: c.baseUrl,
      email: c.email,
      apiToken: decrypt(c.apiToken),
    });
    res.json({
      ok: true,
      accountId: me.accountId,
      displayName: me.displayName,
      emailAddress: me.emailAddress,
    });
  } catch (err) {
    const msg =
      err instanceof JiraError
        ? `JIRA returned ${err.status}: ${typeof err.body === "object" ? JSON.stringify(err.body) : String(err.body)}`
        : err instanceof Error
          ? err.message
          : "Unknown error";
    res.json({ ok: false, error: msg });
  }
});

const ValidateJqlInput = z.object({ jql: z.string().min(1).max(8000) });

function extractJqlError(body: unknown): string {
  if (body && typeof body === "object") {
    const messages = (body as { errorMessages?: unknown }).errorMessages;
    if (Array.isArray(messages) && messages.every((m) => typeof m === "string") && messages.length > 0) {
      return messages.join("; ");
    }
    return JSON.stringify(body);
  }
  return String(body);
}

router.post("/:id/validate-jql", async (req, res) => {
  const parsed = ValidateJqlInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Invalid input" });
    return;
  }
  const c = await prisma.jiraConnection.findUnique({ where: { id: req.params.id } });
  if (!c) {
    res.status(404).json({ ok: false, error: "Connection not found" });
    return;
  }
  try {
    await validateJql(
      { baseUrl: c.baseUrl, email: c.email, apiToken: decrypt(c.apiToken) },
      parsed.data.jql,
    );
    res.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof JiraError
        ? extractJqlError(err.body)
        : err instanceof Error
          ? err.message
          : "Unknown error";
    res.json({ ok: false, error: msg });
  }
});

export default router;
