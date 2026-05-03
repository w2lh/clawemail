import { config } from "./config";
import { deleteSettings, getSetting, setSetting } from "./db";

const AUTH_SETTING_KEYS = [
  "claw.apiKey",
  "claw.dashboardCookie",
  "claw.userEmail",
  "claw.workspaceId",
  "claw.workspaceName",
  "claw.parentMailboxId",
  "claw.rootPrefix",
  "claw.domain"
];

export function getClawApiKey(): string | undefined {
  return getSetting("claw.apiKey") ?? config.CLAW_API_KEY;
}

export function requireClawApiKey(): string {
  const value = getClawApiKey();
  if (!value) {
    throw new Error("CLAW_API_KEY is required for mail operations; connect Claw first");
  }
  return value;
}

export function getDashboardCookie(): string | undefined {
  return getSetting("claw.dashboardCookie") ?? config.CLAW_DASHBOARD_COOKIE;
}

export function requireDashboardCookie(): string {
  const value = getDashboardCookie();
  if (!value) {
    throw new Error("CLAW_DASHBOARD_COOKIE is required for mailbox management; connect Claw first");
  }
  return value;
}

export function getWorkspaceId(): string {
  return getSetting("claw.workspaceId") ?? config.CLAW_WORKSPACE_ID;
}

export function getParentMailboxId(): string {
  return getSetting("claw.parentMailboxId") ?? config.CLAW_PARENT_MAILBOX_ID;
}

export function getRootPrefix(): string {
  return getSetting("claw.rootPrefix") ?? config.CLAW_ROOT_PREFIX;
}

export function getDomain(): string {
  return getSetting("claw.domain") ?? config.CLAW_DOMAIN;
}

export function hasClawMailConfig(): boolean {
  return Boolean(getClawApiKey());
}

export function hasClawDashboardConfig(): boolean {
  return Boolean(getDashboardCookie());
}

export function getClawAuthStatus() {
  const apiKey = getClawApiKey();
  const cookie = getDashboardCookie();
  return {
    connected: Boolean(apiKey && cookie),
    hasApiKey: Boolean(apiKey),
    hasDashboardCookie: Boolean(cookie),
    userEmail: getSetting("claw.userEmail") ?? null,
    workspaceId: getWorkspaceId(),
    workspaceName: getSetting("claw.workspaceName") ?? null,
    parentMailboxId: getParentMailboxId(),
    rootPrefix: getRootPrefix(),
    domain: getDomain(),
    apiKeyPrefix: apiKey ? apiKey.slice(0, 10) : null,
    apiKeySuffix: apiKey ? apiKey.slice(-4) : null
  };
}

export function saveClawAuthSettings(input: {
  apiKey: string;
  dashboardCookie: string;
  userEmail?: string | null;
  workspaceId: string;
  workspaceName?: string | null;
  parentMailboxId: string;
  rootPrefix: string;
  domain: string;
}): void {
  setSetting("claw.apiKey", input.apiKey);
  setSetting("claw.dashboardCookie", input.dashboardCookie);
  setSetting("claw.workspaceId", input.workspaceId);
  setSetting("claw.parentMailboxId", input.parentMailboxId);
  setSetting("claw.rootPrefix", input.rootPrefix);
  setSetting("claw.domain", input.domain);
  if (input.userEmail) setSetting("claw.userEmail", input.userEmail);
  if (input.workspaceName) setSetting("claw.workspaceName", input.workspaceName);
}

export function clearClawAuthSettings(): void {
  deleteSettings(AUTH_SETTING_KEYS);
}
