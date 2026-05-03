import { MailClient, MailSdkError } from "@clawemail/node-sdk";
import { requireClawApiKey } from "./runtime-config";

export type SendMailInput = {
  from: string;
  to: string[];
  subject?: string;
  body?: string;
  html?: boolean;
  cc?: string[];
  bcc?: string[];
};

export type ReplyMailInput = {
  mailboxEmail: string;
  providerMailId: string;
  body?: string;
  html?: boolean;
  toAll?: boolean;
};

const clients = new Map<string, MailClient>();

export function getMailClient(email: string): MailClient {
  const normalized = email.trim().toLowerCase();
  const existing = clients.get(normalized);
  if (existing) return existing;

  const client = new MailClient({
    apiKey: requireClawApiKey(),
    user: normalized,
    logger: null
  });
  clients.set(normalized, client);
  return client;
}

export function resetMailClients(): void {
  for (const client of clients.values()) {
    try {
      client.ws.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
  clients.clear();
}

export async function sendMail(input: SendMailInput): Promise<{ status: "sent" }> {
  if (!input.to.length) {
    throw new Error("to must not be empty");
  }
  const client = getMailClient(input.from);
  return await client.mail.send({
    to: input.to,
    subject: input.subject,
    body: input.body,
    html: input.html,
    cc: input.cc,
    bcc: input.bcc
  });
}

export async function replyMail(input: ReplyMailInput): Promise<{ status: "sent" }> {
  const client = getMailClient(input.mailboxEmail);
  return await client.mail.reply({
    id: input.providerMailId,
    body: input.body,
    html: input.html,
    toAll: input.toAll
  });
}

export function formatSdkError(error: unknown): string {
  if (error instanceof MailSdkError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
