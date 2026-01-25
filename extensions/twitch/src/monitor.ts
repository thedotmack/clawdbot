/**
 * Twitch message monitor - processes incoming messages and routes to agents.
 *
 * This monitor connects to the Twitch client manager, processes incoming messages,
 * resolves agent routes, and handles replies.
 */

import type { ReplyPayload } from "clawdbot/plugin-sdk";
import type { TwitchAccountConfig, TwitchChatMessage } from "./types.js";
import { checkTwitchAccessControl } from "./access-control.js";
import { getTwitchRuntime } from "./runtime.js";
import { getOrCreateClientManager } from "./client-manager-registry.js";

export type TwitchRuntimeEnv = {
  log?: (message: string) => void;
  error?: (message: string) => void;
};

export type TwitchMonitorOptions = {
  account: TwitchAccountConfig;
  accountId: string;
  config: unknown; // ClawdbotConfig
  runtime: TwitchRuntimeEnv;
  abortSignal: AbortSignal;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

export type TwitchMonitorResult = {
  stop: () => void;
};

type TwitchCoreRuntime = ReturnType<typeof getTwitchRuntime>;

/**
 * Process an incoming Twitch message and dispatch to agent.
 */
async function processTwitchMessage(params: {
  message: TwitchChatMessage;
  account: TwitchAccountConfig;
  accountId: string;
  config: unknown;
  runtime: TwitchRuntimeEnv;
  core: TwitchCoreRuntime;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { message, account, accountId, config, runtime, core, statusSink } = params;

  // Resolve route for this message
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config as Parameters<typeof core.channel.routing.resolveAgentRoute>[0]["cfg"],
    channel: "twitch",
    accountId,
    peer: {
      kind: "group", // Twitch chat is always group-like
      id: message.channel,
    },
  });

  // Build message body
  const rawBody = message.message;
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Twitch",
    from: message.displayName ?? message.username,
    timestamp: message.timestamp?.getTime(),
    envelope: core.channel.reply.resolveEnvelopeFormatOptions(
      config as Parameters<typeof core.channel.reply.resolveEnvelopeFormatOptions>[0],
    ),
    body: rawBody,
  });

  // Build context payload
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `twitch:user:${message.userId}`,
    To: `twitch:channel:${message.channel}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "group",
    ConversationLabel: message.channel,
    SenderName: message.displayName ?? message.username,
    SenderId: message.userId,
    SenderUsername: message.username,
    Provider: "twitch",
    Surface: "twitch",
    MessageSid: message.id,
    OriginatingChannel: "twitch",
    OriginatingTo: `twitch:channel:${message.channel}`,
  });

  // Record session
  const storePath = core.channel.session.resolveStorePath(
    (config as Parameters<typeof core.channel.session.resolveStorePath>[0]["cfg"])?.session?.store,
    { agentId: route.agentId },
  );
  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      runtime.error?.(`[twitch] Failed updating session meta: ${String(err)}`);
    },
  });

  // Resolve markdown table mode
  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config as Parameters<typeof core.channel.text.resolveMarkdownTableMode>[0]["cfg"],
    channel: "twitch",
    accountId,
  });

  // Dispatch reply
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config as Parameters<
      typeof core.channel.reply.dispatchReplyWithBufferedBlockDispatcher
    >[0]["cfg"],
    dispatcherOptions: {
      deliver: async (payload) => {
        await deliverTwitchReply({
          payload,
          channel: message.channel,
          account,
          accountId,
          config,
          tableMode,
          runtime,
          statusSink,
        });
      },
    },
  });
}

/**
 * Deliver a reply to Twitch chat.
 */
async function deliverTwitchReply(params: {
  payload: ReplyPayload;
  channel: string;
  account: TwitchAccountConfig;
  accountId: string;
  config: unknown;
  tableMode: "off" | "plain" | "markdown" | "bullets" | "code";
  runtime: TwitchRuntimeEnv;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
}): Promise<void> {
  const { payload, channel, account, accountId, config, tableMode, runtime, statusSink } = params;

  try {
    const clientManager = getOrCreateClientManager(accountId, {
      info: (msg) => runtime.log?.(`[twitch] ${msg}`),
      warn: (msg) => runtime.log?.(`[twitch] ${msg}`),
      error: (msg) => runtime.error?.(`[twitch] ${msg}`),
      debug: (msg) => runtime.log?.(`[twitch] ${msg}`),
    });

    const client = await clientManager.getClient(
      account,
      config as Parameters<typeof clientManager.getClient>[1],
      accountId,
    );
    if (!client) {
      runtime.error?.(`[twitch] No client available for sending reply`);
      return;
    }

    // Send the reply
    if (!payload.text) {
      runtime.error?.(`[twitch] No text to send in reply payload`);
      return;
    }
    await client.say(channel, payload.text);
    statusSink?.({ lastOutboundAt: Date.now() });
  } catch (err) {
    runtime.error?.(`[twitch] Failed to send reply: ${String(err)}`);
  }
}

/**
 * Main monitor provider for Twitch.
 *
 * Sets up message handlers and processes incoming messages.
 */
export async function monitorTwitchProvider(
  options: TwitchMonitorOptions,
): Promise<TwitchMonitorResult> {
  const { account, accountId, config, runtime, abortSignal, statusSink } = options;

  const core = getTwitchRuntime();
  let stopped = false;

  // Create logger for client manager
  const logger = {
    info: (msg: string) => runtime.log?.(`[twitch] ${msg}`),
    warn: (msg: string) => runtime.log?.(`[twitch] ${msg}`),
    error: (msg: string) => runtime.error?.(`[twitch] ${msg}`),
    debug: (msg: string) => runtime.log?.(`[twitch] ${msg}`),
  };

  // Get or create client manager
  const clientManager = getOrCreateClientManager(accountId, logger);

  // Establish connection
  try {
    await clientManager.getClient(
      account,
      config as Parameters<typeof clientManager.getClient>[1],
      accountId,
    );
    runtime.log?.(`[twitch] Connected to Twitch as ${account.username}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    runtime.error?.(`[twitch] Failed to connect: ${errorMsg}`);
    throw error;
  }

  // Register message handler
  const unregisterHandler = clientManager.onMessage(account, async (message) => {
    if (stopped) return;

    // Access control check
    const botUsername = account.username.toLowerCase();
    if (message.username.toLowerCase() === botUsername) {
      return; // Ignore own messages
    }

    const access = checkTwitchAccessControl({
      message,
      account,
      botUsername,
    });

    if (!access.allowed) {
      runtime.log?.(
        `[twitch] Ignored message from ${message.username}: ${access.reason ?? "blocked"}`,
      );
      return;
    }

    statusSink?.({ lastInboundAt: Date.now() });

    try {
      await processTwitchMessage({
        message,
        account,
        accountId,
        config,
        runtime,
        core,
        statusSink,
      });
    } catch (err) {
      runtime.error?.(`[twitch] Message processing failed: ${String(err)}`);
    }
  });

  // Stop function
  const stop = () => {
    stopped = true;
    unregisterHandler();
  };

  // Handle abort signal
  abortSignal.addEventListener("abort", stop, { once: true });

  return { stop };
}
