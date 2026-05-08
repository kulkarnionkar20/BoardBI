import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { env } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import connections from "./routes/connections.js";
import reports from "./routes/reports.js";
import fields from "./routes/fields.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "0.0.0" });
});

app.use("/api/connections", requireAuth, connections);
app.use("/api/reports", requireAuth, reports);
app.use("/api/fields", requireAuth, fields);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
};
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`BoardBI API listening on http://localhost:${env.port}`);
});
