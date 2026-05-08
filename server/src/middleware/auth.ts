import type { RequestHandler } from "express";

// v0 seam: no real auth yet. Replace this in v2 with session/JWT/whatever.
// Keep all routes mounted behind it so adding auth becomes a one-file change.
export const requireAuth: RequestHandler = (_req, _res, next) => {
  next();
};
