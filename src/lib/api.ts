import ky from "ky";

export const api = ky.create({
  prefixUrl: "/api",
  timeout: 30_000,
});

export type ApiError = { error: string; details?: unknown };
