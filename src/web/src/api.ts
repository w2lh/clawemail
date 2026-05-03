export type Mailbox = {
  id: string;
  email: string;
  prefix: string;
  display_name: string | null;
  account_id: string | null;
  status: string;
  openclaw_status: string | null;
  install_command: string | null;
  auth_url: string | null;
  created_at: string;
  updated_at: string;
};

export type MailSummary = {
  id: number;
  provider_mail_id: string;
  mailbox_email: string;
  source: string | null;
  address: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  has_attachments: number;
  received_at: string | null;
  created_at: string;
};

export type MailDetail = MailSummary & {
  parsed: any;
  attachments: Array<{
    id: number;
    mail_id: number;
    provider_part_id: string;
    filename: string | null;
    content_type: string | null;
    size: number | null;
  }>;
};

export type ClawAuthStatus = {
  connected: boolean;
  hasApiKey: boolean;
  hasDashboardCookie: boolean;
  userEmail: string | null;
  workspaceId: string;
  workspaceName: string | null;
  parentMailboxId: string;
  rootPrefix: string;
  domain: string;
  apiKeyPrefix: string | null;
  apiKeySuffix: string | null;
};

let adminPassword = localStorage.getItem("adminPassword") ?? "";

export function getAdminPassword() {
  return adminPassword;
}

export function setAdminPassword(value: string) {
  adminPassword = value;
  localStorage.setItem("adminPassword", value);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-password": adminPassword,
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error ?? `HTTP ${response.status}`);
  }
  return data as T;
}

export async function fetchMailboxes(sync = false): Promise<Mailbox[]> {
  const data = await requestJson<{ items: Mailbox[] }>(`/api/mailboxes${sync ? "?sync=true" : ""}`);
  return data.items;
}

export async function createMailbox(suffix: string): Promise<Mailbox> {
  return requestJson<Mailbox>("/api/mailboxes", {
    method: "POST",
    body: JSON.stringify({ suffix })
  });
}

export async function deleteMailbox(id: string): Promise<void> {
  await requestJson<{ success: boolean }>(`/api/mailboxes/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function fetchMails(mailbox?: string): Promise<{ items: MailSummary[]; count: number }> {
  const params = new URLSearchParams({ limit: "50", offset: "0" });
  if (mailbox) params.set("mailbox", mailbox);
  return requestJson(`/api/mails?${params.toString()}`);
}

export async function fetchMail(id: number): Promise<MailDetail> {
  return requestJson(`/api/mails/${id}`);
}

export async function sendMail(input: {
  from: string;
  to: string[];
  subject?: string;
  body?: string;
  html?: boolean;
}) {
  return requestJson<{ status: "sent" }>("/api/send", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function replyMail(input: {
  mailId: number;
  body?: string;
  html?: boolean;
  toAll?: boolean;
}) {
  return requestJson<{ status: "sent" }>("/api/reply", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function createEventSource(): EventSource {
  return new EventSource(`/api/events?token=${encodeURIComponent(adminPassword)}`);
}

export async function fetchClawAuthStatus(): Promise<ClawAuthStatus> {
  return requestJson<ClawAuthStatus>("/api/auth/claw/status");
}

export async function sendClawLoginCode(email: string): Promise<void> {
  await requestJson<{ success: boolean }>("/api/auth/claw/send-code", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export async function verifyClawLoginCode(email: string, code: string): Promise<{
  auth: ClawAuthStatus;
  syncedMailboxes: number;
}> {
  return requestJson("/api/auth/claw/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
}

export async function refreshClawConnection(): Promise<{
  auth: ClawAuthStatus;
  syncedMailboxes: number;
}> {
  return requestJson("/api/auth/claw/refresh", {
    method: "POST"
  });
}

export async function disconnectClaw(): Promise<ClawAuthStatus> {
  return requestJson("/api/auth/claw/logout", {
    method: "POST"
  });
}
