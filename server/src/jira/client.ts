import { env } from "../env.js";

export type JiraCreds = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export type JiraMyself = {
  accountId: string;
  displayName: string;
  emailAddress?: string;
};

function authHeader(creds: JiraCreds): string {
  const raw = `${creds.email}:${creds.apiToken}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function joinUrl(baseUrl: string, path: string): string {
  const b = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export class JiraError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(creds: JiraCreds, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(joinUrl(creds.baseUrl, path), {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": env.jiraUserAgent,
      Authorization: authHeader(creds),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new JiraError(res.status, body, `JIRA ${res.status} ${res.statusText} for ${path}`);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function getMyself(creds: JiraCreds): Promise<JiraMyself> {
  return request<JiraMyself>(creds, "/rest/api/3/myself");
}

export type JiraField = {
  id: string;
  name: string;
  custom: boolean;
  schema?: { type?: string; items?: string };
};

export async function listFields(creds: JiraCreds): Promise<JiraField[]> {
  const raw = await request<JiraField[]>(creds, "/rest/api/3/field");
  return raw.map((f) => ({
    id: f.id,
    name: f.name,
    custom: f.custom,
    schema: f.schema ? { type: f.schema.type, items: f.schema.items } : undefined,
  }));
}

export type JiraIssue = {
  id: string;
  key: string;
  fields: Record<string, unknown>;
};

// JIRA Cloud's new token-paginated search endpoint (the legacy /rest/api/3/search
// was removed in 2025). Response no longer includes a total count.
type SearchJqlResponse = {
  issues: JiraIssue[];
  isLast?: boolean;
  nextPageToken?: string;
};

export type SearchResult = {
  rows: JiraIssue[];
  truncated: boolean;
};

export const SEARCH_PAGE_SIZE = 100;
export const SEARCH_ROW_CAP = 5000;

export async function validateJql(creds: JiraCreds, jql: string): Promise<void> {
  await request(creds, "/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({ jql, maxResults: 0, fields: ["summary"] }),
  });
}

export async function searchAll(
  creds: JiraCreds,
  jql: string,
  opts?: { rowCap?: number; pageSize?: number; fields?: string[] },
): Promise<SearchResult> {
  const rowCap = opts?.rowCap ?? SEARCH_ROW_CAP;
  const pageSize = Math.min(opts?.pageSize ?? SEARCH_PAGE_SIZE, 5000);
  const fieldsParam = opts?.fields?.length ? opts.fields : ["*all"];
  const rows: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  let isLast = false;
  for (;;) {
    const remaining = rowCap - rows.length;
    if (remaining <= 0) break;
    const body = {
      jql,
      maxResults: Math.min(pageSize, remaining),
      fields: fieldsParam,
      ...(nextPageToken ? { nextPageToken } : {}),
    };
    const page = await request<SearchJqlResponse>(creds, "/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    });
    rows.push(...page.issues);
    isLast = page.isLast === true || !page.nextPageToken;
    if (isLast) break;
    if (page.issues.length === 0) break;
    nextPageToken = page.nextPageToken;
  }
  return { rows, truncated: !isLast && rows.length >= rowCap };
}
