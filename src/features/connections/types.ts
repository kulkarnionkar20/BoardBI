export type JiraConnection = {
  id: string;
  name: string;
  baseUrl: string;
  email: string;
  createdAt: string;
};

export type CreateConnectionInput = {
  name: string;
  baseUrl: string;
  email: string;
  apiToken: string;
};

export type TestConnectionResult =
  | { ok: true; accountId: string; displayName: string; emailAddress?: string }
  | { ok: false; error: string };
