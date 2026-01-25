import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import type { TwitchAccountConfig, TwitchPluginConfig } from "./types.js";

/**
 * Default account ID for Twitch
 */
export const DEFAULT_ACCOUNT_ID = "default";

/**
 * Get account config from core config
 *
 * Handles two patterns:
 * 1. Simplified single-account: base-level properties create implicit "default" account
 * 2. Multi-account: explicit accounts object
 *
 * For "default" account, base-level properties take precedence over accounts.default
 * For other accounts, only the accounts object is checked
 */
export function getAccountConfig(
  coreConfig: unknown,
  accountId: string,
): TwitchAccountConfig | null {
  if (!coreConfig || typeof coreConfig !== "object") {
    return null;
  }

  const cfg = coreConfig as Record<string, unknown>;
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const twitch = channels?.twitch as Record<string, unknown> | undefined;
  const accounts = twitch?.accounts as Record<string, unknown> | undefined;

  // For default account, check base-level config first
  if (accountId === DEFAULT_ACCOUNT_ID) {
    const accountFromAccounts = accounts?.[DEFAULT_ACCOUNT_ID] as
      | Record<string, unknown>
      | undefined;

    // Base-level properties that can form an implicit default account
    const baseLevel = {
      username: typeof twitch?.username === "string" ? twitch.username : undefined,
      accessToken: typeof twitch?.accessToken === "string" ? twitch.accessToken : undefined,
      clientId: typeof twitch?.clientId === "string" ? twitch.clientId : undefined,
      channel: typeof twitch?.channel === "string" ? twitch.channel : undefined,
      enabled: typeof twitch?.enabled === "boolean" ? twitch.enabled : undefined,
      allowFrom: Array.isArray(twitch?.allowFrom) ? twitch.allowFrom : undefined,
      allowedRoles: Array.isArray(twitch?.allowedRoles) ? twitch.allowedRoles : undefined,
      requireMention:
        typeof twitch?.requireMention === "boolean" ? twitch.requireMention : undefined,
      clientSecret: typeof twitch?.clientSecret === "string" ? twitch.clientSecret : undefined,
      refreshToken: typeof twitch?.refreshToken === "string" ? twitch.refreshToken : undefined,
      expiresIn: typeof twitch?.expiresIn === "number" ? twitch.expiresIn : undefined,
      obtainmentTimestamp:
        typeof twitch?.obtainmentTimestamp === "number" ? twitch.obtainmentTimestamp : undefined,
    };

    // Merge: base-level takes precedence over accounts.default
    const merged = {
      ...accountFromAccounts,
      ...baseLevel,
    } as Record<string, unknown>;

    // Only return if we have at least username
    if (merged.username) {
      return merged as unknown as TwitchAccountConfig;
    }

    // Fall through to accounts.default if no base-level username
    if (accountFromAccounts) {
      return accountFromAccounts as unknown as TwitchAccountConfig;
    }

    return null;
  }

  // For non-default accounts, only check accounts object
  if (!accounts || !accounts[accountId]) {
    return null;
  }

  return accounts[accountId] as TwitchAccountConfig | null;
}

/**
 * Parse plugin config
 */
export function parsePluginConfig(value: unknown): TwitchPluginConfig {
  if (!value || typeof value !== "object") {
    return { stripMarkdown: true };
  }

  const raw = value as Record<string, unknown>;
  return {
    stripMarkdown: typeof raw.stripMarkdown === "boolean" ? raw.stripMarkdown : true,
  };
}

/**
 * List all configured account IDs
 *
 * Includes both explicit accounts and implicit "default" from base-level config
 */
export function listAccountIds(cfg: ClawdbotConfig): string[] {
  const accounts = (cfg as Record<string, unknown>).channels as Record<string, unknown> | undefined;
  const twitch = accounts?.twitch as Record<string, unknown> | undefined;
  const accountMap = twitch?.accounts as Record<string, unknown> | undefined;

  const ids: string[] = [];

  // Add explicit accounts
  if (accountMap) {
    ids.push(...Object.keys(accountMap));
  }

  // Add implicit "default" if base-level config exists and "default" not already present
  const hasBaseLevelConfig =
    twitch &&
    (typeof twitch.username === "string" ||
      typeof twitch.accessToken === "string" ||
      typeof twitch.channel === "string");

  if (hasBaseLevelConfig && !ids.includes(DEFAULT_ACCOUNT_ID)) {
    ids.push(DEFAULT_ACCOUNT_ID);
  }

  return ids;
}
