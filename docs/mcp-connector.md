# Claude connector (MCP server)

The dashboard exposes a read-only [MCP](https://modelcontextprotocol.io) server at
`/api/mcp`, so any Claude account can query its data as a custom connector.
Each person who connects signs in to the dashboard and approves access, and
Claude then sees exactly what that person sees in the web app (same rules as
`lib/access.ts`). It can't run prompts or change anything.

## Connect from Claude

Use the URL of the deployment whose data you want, for example
`https://<your-app>.vercel.app/api/mcp`.

- **Claude Team / Enterprise:** an Owner goes to **Admin settings → Connectors → Add custom connector**,
  enters the URL and leaves the OAuth fields empty. Each member then opens
  **Settings → Connectors**, clicks **Connect** on it, signs in to the dashboard and clicks **Allow**.
- **Claude Pro / Max:** **Settings → Connectors → Add custom connector**, same URL.
- **Claude Code:**
  ```sh
  claude mcp add --transport http ai-visibility https://<your-app>.vercel.app/api/mcp
  ```
  then run `/mcp` in Claude Code to sign in.

If the app sits behind a firewall or IP allowlist, Anthropic's outbound IP ranges
must be allowed, because claude.ai connects to it from Anthropic's servers.

## Tools

| Tool | What it returns |
| --- | --- |
| `list_projects` | Projects (brands) you can see, their prompt sets and competitors. Gives the `project_id` every other tool takes. |
| `get_visibility_summary` | Mention rate, citation rate, sentiment and average position overall and per platform, with the same numbers for each competitor. |
| `get_segment_breakdown` | The same rates grouped by category, entity, market, city, level of care or platform. |
| `get_trends` | Rates for each finished run session, oldest first. This is also where run session ids come from. |
| `list_prompts` | Tracked prompts with tags and per-prompt mention and citation rates. |
| `get_prompt_results` | The actual answer from each platform for one prompt, with cited sources and competitor mentions. |
| `get_top_cited_domains` | The sites AI answers cite most, flagged as brand, competitor or third party. |
| `get_visibility_gaps` | Prompts where a competitor was mentioned and the brand wasn't. |
| `list_competitors` | Tracked competitors, with their domains and aliases. |

By default, results cover every run, as on the dashboard. Pass `run_session_id: "latest"`
to get the newest snapshot only.

## How auth works

The app is its own OAuth 2.1 authorization server (`lib/mcp/oauth.ts`):

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/oauth-protected-resource` | RFC 9728 metadata. `/api/mcp` points to it in its 401 response. |
| `/.well-known/oauth-authorization-server` | RFC 8414 metadata. |
| `POST /api/oauth/register` | Dynamic client registration (public clients, PKCE only). |
| `/oauth/authorize` | NextAuth sign-in, then a consent screen (`app/oauth/authorize`). |
| `POST /api/oauth/token` | Exchanges the code for tokens, and refreshes tokens. Refresh tokens rotate. |
| `POST /api/oauth/revoke` | Revokes a token. |

Access tokens last 1 hour and refresh tokens last 30 days. The tables are
`OAuthClient`, `OAuthAuthCode` and `OAuthToken`, and they store only SHA-256
hashes of codes and tokens. To cut off someone's connector, set `revokedAt` on
their `OAuthToken` rows, or delete those rows.

No new environment variables are needed. URLs come from the request host, so
preview and production deployments each advertise their own.
