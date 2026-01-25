---
summary: "Twitch chat bot support status, capabilities, and configuration"
read_when:
  - Setting up Twitch chat integration for Clawdbot
  - Configuring Twitch bot permissions and access control
---
# Twitch (plugin)

Twitch chat support via IRC connection. Clawdbot connects as a Twitch user (bot account) to receive and send messages in channels.

Status: ready for Twitch chat via IRC connection with @twurple.

## Quick setup (beginner)
1) Install the Twitch plugin.
2) Generate your credentials (recommended: use [Twitch Token Generator](https://twitchtokengenerator.com/)):
   - Select **Bot Token**
   - Verify scopes `chat:read` and `chat:write` are selected
   - Copy the **Client ID** and **Access Token** (and optionally **Refresh Token**)
3) Set the credentials for Clawdbot:
   - Env: `CLAWDBOT_TWITCH_ACCESS_TOKEN=...` (default account only)
   - Or config: `channels.twitch.accounts.default.token`
   - If both are set, config takes precedence (env fallback is default-account only).
4) Start the gateway.
5) The bot joins your channel and responds to messages.

Minimal config:
```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "clawdbot",              // Bot's Twitch account
      accessToken: "oauth:abc123...",    // OAuth Access Token (or use CLAWDBOT_TWITCH_ACCESS_TOKEN env var)
      clientId: "your_client_id",        // Client ID from Token Generator
      channel: "vevisk"                  // Which Twitch channel's chat to join
    }
  }
}
```

**Note:** [Twitch Token Generator](https://twitchtokengenerator.com/) provides the Client ID and Access Token (select **Bot Token** and verify `chat:read` + `chat:write` scopes) - no manual app registration needed.

**Note:** `username` is the bot's account, `channel` is which chat to join.

**Multi-account setup:** Use `channels.twitch.accounts` for advanced multi-account configurations.

## How it works
1. Create a bot account (or use an existing Twitch account).
2. Generate credentials using [Twitch Token Generator](https://twitchtokengenerator.com/) (provides Client ID, Access Token, and Refresh Token).
3. Configure Clawdbot with the credentials.
4. Run the gateway; it auto-starts the Twitch channel when a token is available (config first, env fallback) and `channels.twitch.enabled` is not `false`.
5. The bot joins the specified `channel` to send/receive messages.
6. Direct chats collapse into the agent's main session (default `agent:main:main`); each account maps to an isolated session key `agent:<agentId>:twitch:<accountName>`.

**Key distinction:** `username` is who the bot authenticates as (the bot's account), `channel` is which chat room it joins.

## Plugin required

Twitch ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
clawdbot plugins install @clawdbot/twitch
```

Local checkout (when running from a git repo):

```bash
clawdbot plugins install ./extensions/twitch
```

Details: [Plugins](/plugin)

## Setup

### 1) Generate your credentials (recommended: Twitch Token Generator)
- Go to [Twitch Token Generator](https://twitchtokengenerator.com/)
- Select **Bot Token**
- Verify scopes `chat:read` and `chat:write` are selected
- Copy the **Access Token** and **Client ID**

### 2) Configure credentials
Env (default account only):
```bash
export CLAWDBOT_TWITCH_ACCESS_TOKEN=your_access_token_here
```

Or config:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      accounts: {
        default: {
          username: "clawdbot",              // Bot's Twitch account
          accessToken: "oauth:abc123...",    // Access Token from Token Generator (or omit to use env var)
          clientId: "xyz789...",             // Client ID from Token Generator
          channel: "vevisk"                  // Which Twitch channel's chat to join
        }
      }
    }
  }
}
```

**Note:** Copy the **Access Token** value to the `accessToken` property (add `oauth:` prefix if needed), and the **Client ID** value to the `clientId` property.

With env, you still need `clientId` and `channel` in config (or use the minimal config above without `accessToken`).

### 3) Start the gateway
Twitch starts when a token is resolved (config first, env fallback).

### 4) Join a channel
The bot joins the channel specified in `channel`.

## Token refresh (optional, for long-running bots)

**Important:** Tokens from [Twitch Token Generator](https://twitchtokengenerator.com/) cannot be automatically refreshed - you'll need to generate a new token when it expires (typically after several hours).

For automatic token refresh, you must create your own Twitch application:

1. Create a Twitch application at [Twitch Developer Console](https://dev.twitch.tv/console)
   - Copy the **Client ID** and **Client Secret**
2. Generate a refresh token using your own app (you'll need to implement the OAuth flow or use a tool that lets you specify your Client ID)
3. Add to config:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "clawdbot",
          accessToken: "oauth:abc123...",    // Access Token from your app
          clientId: "xyz789...",             // Client ID from your app
          clientSecret: "secret123...",      // Client Secret from your app
          refreshToken: "refresh456...",     // Refresh Token from your app
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000
        }
      }
    }
  }
}
```

**Note:** All three values (`accessToken`, `clientId`, `refreshToken`) must come from the same Twitch application you created.

The bot automatically refreshes tokens before they expire and logs refresh events.

## Routing model
- Replies always go back to Twitch.
- Each account maps to `agent:<agentId>:twitch:<accountName>`.

## Multi-account support

Use `channels.twitch.accounts` with per-account tokens and optional `name`. See [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) for the shared pattern.

Example (one bot account in two different channels):

```json5
{
  channels: {
    twitch: {
      accounts: {
        ninjaChannel: {
          username: "clawdbot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk"
        },
        shroudChannel: {
          username: "clawdbot",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel"
        }
      }
    }
  }
}
```

## Migration notes

### Breaking changes (2026.1.23+)

**`token` renamed to `accessToken`:** If you have existing Twitch config using `token`, update to `accessToken`:

**Before:**
```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "clawdbot",
          token: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk"
        }
      }
    }
  }
}
```

**After:**
```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "clawdbot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk"
        }
      }
    }
  }
}
```

**Simplified config (recommended):** For single-account setups, you can now use base-level properties:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "clawdbot",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk"
    }
  }
}
```

The env var `CLAWDBOT_TWITCH_ACCESS_TOKEN` continues to work for the default account.

## Access control

### Role-based restrictions (recommended)

Restrict access to specific roles:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowedRoles: ["moderator", "vip"]
        }
      }
    }
  }
}
```

**Available roles:**
- `"moderator"` - Channel moderators
- `"owner"` - Channel owner/broadcaster
- `"vip"` - VIPs
- `"subscriber"` - Subscribers
- `"all"` - Anyone in chat

### Allowlist by User ID

Only allow specific Twitch user IDs (most secure):

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowFrom: ["123456789", "987654321"]
        }
      }
    }
  }
}
```

**Why user IDs instead of usernames?** Twitch usernames can change, which could allow someone to hijack another user's access. User IDs are permanent.

Find your Twitch user ID at: https://www.streamweasels.com/tools/convert-your-twitch-username-to-user-id/

### Combined allowlist + roles

Users in `allowFrom` bypass role checks. In this example:
- User `123456789` can always message (bypasses role check)
- All moderators can message
- Everyone else is blocked

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          allowFrom: ["123456789"],
          allowedRoles: ["moderator"]
        }
      }
    }
  }
}
```

### Require @mention

Only respond when the bot is mentioned:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          requireMention: true
        }
      }
    }
  }
}
```

## Environment variables

For the default account, you can use environment variables instead of config:

- `CLAWDBOT_TWITCH_ACCESS_TOKEN` - Access Token (without `oauth:` prefix)

Env fallback only works for the default account. For multi-account setups, use config.

Example:

```bash
export CLAWDBOT_TWITCH_ACCESS_TOKEN=abc123def456...
```

Config with env fallback:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      accounts: {
        default: {
          username: "mybot",
          clientId: "xyz789...",
          channel: "your_channel"
          // token will be read from CLAWDBOT_TWITCH_ACCESS_TOKEN
        }
      }
    }
  }
}
```

Priority: account config > base config > env var (for default account only).

## Plugin options

Control markdown stripping behavior:

```json5
{
  plugins: {
    entries: {
      twitch: {
        stripMarkdown: true
      }
    }
  }
}
```

- `stripMarkdown` (default: `true`) - Remove markdown formatting before sending to Twitch

Twitch doesn't support markdown, so this is enabled by default. Disable if you want to send markdown as-is (it will appear as plain text with markdown symbols).

## Capabilities & limits

**Supported:**
- ✅ Channel messages (group chat)
- ✅ Whispers/DMs (received but replies not supported - Twitch doesn't allow bots to send whispers)
- ✅ Markdown stripping (automatically applied)
- ✅ Message chunking (500 char limit)
- ✅ Access control (user ID allowlist, role-based)
- ✅ @mention requirement
- ✅ Automatic token refresh (with RefreshingAuthProvider)
- ✅ Multi-account support

**Not supported:**
- ❌ Native reactions
- ❌ Threaded replies
- ❌ Message editing
- ❌ Message deletion
- ❌ Rich embeds/media uploads (sends media URLs as text)

## Troubleshooting

First, run diagnostic commands:

```bash
clawdbot doctor
clawdbot channels status --probe
```

### Bot doesn't respond to messages

**Check access control:**
```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          // Temporary: allow everyone
          allowedRoles: ["all"]
        }
      }
    }
  }
}
```

**Check the bot is in the channel:** The bot must join the channel specified in `channel`.

### Token issues

**"Failed to connect" or authentication errors:**
- Verify `accessToken` is the OAuth access token value (typically starts with `oauth:` prefix)
- Check token has `chat:read` and `chat:write` scopes
- If using RefreshingAuthProvider, verify `clientSecret` and `refreshToken` are set

### Token refresh not working

**Check logs for refresh events:**
```
[twitch] Using env token source for mybot
[twitch] Access token refreshed for user 123456 (expires in 14400s)
```

If you see "token refresh disabled (no refresh token)":
- Ensure `clientSecret` is provided
- Ensure `refreshToken` is provided (from Twitch Token Generator with "Include Refresh Token" checked)

## Configuration reference (Twitch)

Full configuration: [Configuration](/gateway/configuration)

### Account config

```typescript
{
  username: string,           // Bot username
  accessToken: string,        // OAuth access token with chat:read and chat:write
  clientId: string,           // Twitch Client ID (from Token Generator site or your app)
  channel: string,            // Channel to join
  enabled?: boolean,          // Enable this account (default: true)
  clientSecret?: string,      // Optional: For automatic token refresh (from YOUR Twitch app)
  refreshToken?: string,      // Optional: For automatic token refresh (from YOUR Twitch app)
  expiresIn?: number,         // Token expiry in seconds (for refresh)
  obtainmentTimestamp?: number, // Token obtained timestamp (for refresh)
  allowFrom?: string[],       // User ID allowlist
  allowedRoles?: TwitchRole[], // Role-based access control
  requireMention?: boolean    // Require @mention (default: false)
}
```

**TwitchRole:** `"moderator"` | `"owner"` | `"vip"` | `"subscriber"` | `"all"`

### Plugin config

```typescript
{
  stripMarkdown?: boolean  // Strip markdown from outbound (default: true)
}
```

Provider options:
- `channels.twitch.enabled`: enable/disable channel startup.
- `channels.twitch.username`: bot username (simplified single-account config).
- `channels.twitch.accessToken`: OAuth access token (simplified single-account config).
- `channels.twitch.clientId`: Twitch Client ID (simplified single-account config).
- `channels.twitch.channel`: channel to join (simplified single-account config).
- `channels.twitch.accounts.<accountName>.username`: bot username (multi-account config).
- `channels.twitch.accounts.<accountName>.accessToken`: OAuth access token (multi-account config).
- `channels.twitch.accounts.<accountName>.clientId`: Twitch Client ID (from Token Generator or your app).
- `channels.twitch.accounts.<accountName>.channel`: channel to join.
- `channels.twitch.accounts.<accountName>.enabled`: enable/disable account (default: true).
- `channels.twitch.accounts.<accountName>.clientSecret`: optional, for automatic token refresh (must be from YOUR Twitch app).
- `channels.twitch.accounts.<accountName>.refreshToken`: optional, for automatic token refresh (must be from YOUR Twitch app).
- `channels.twitch.accounts.<accountName>.expiresIn`: token expiry in seconds.
- `channels.twitch.accounts.<accountName>.obtainmentTimestamp`: token obtained timestamp.
- `channels.twitch.accounts.<accountName>.allowFrom`: user ID allowlist.
- `channels.twitch.accounts.<accountName>.allowedRoles`: role-based access control.
- `channels.twitch.accounts.<accountName>.requireMention`: require @mention (default: false).

## Tool actions

The agent can call `twitch` with action:

- `send` - Send a message to a channel

Example:

```json5
{
  "action": "twitch",
  "params": {
    "message": "Hello Twitch!",
    "to": "#mychannel"
  }
}
```

## Safety & ops

- **Treat tokens like passwords** - Never commit tokens to git
- **Use RefreshingAuthProvider** for long-running bots
- **Use user ID allowlists** instead of usernames for access control
- **Monitor logs** for token refresh events and connection status
- **Scope tokens minimally** - Only request `chat:read` and `chat:write`
- **If stuck**: Restart the gateway after confirming no other process owns the session

## Message limits

- **500 characters** per message (Twitch limit)
- Messages are automatically chunked at word boundaries
- Markdown is stripped before chunking to avoid breaking patterns
- No rate limiting (uses Twitch's built-in rate limits)
