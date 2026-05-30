// Agent Zero HTTP client.
//
// Three surfaces against AZ's REST API:
//
// 1. sendMessage(req) — POST /api/api_message, blocks until the agent finishes.
//    Returns { contextId, response }. Same endpoint a0 CLI + the habitat
//    health-check cron use.
//
// 2. streamMessage(req, onLogItem) — kicks off the agent and streams its log
//    items as they happen. Two-phase:
//      a. POST /api/api_message_async — returns the context_id immediately
//         (the agent task runs in the background).
//      b. Poll /api/api_log_get on that context_id every ~400ms, emit each
//         new log item via onLogItem, stop when progress_active=false.
//    Returns the final { contextId, response } where `response` is the
//    last log item of type 'response'.
//
//    NOTE: api_message_async is a small AZ patch (deployed on habitat as
//    api/api_message_async.py) — a key-authed clone of the framework's own
//    web-authed message_async. Without it the framework only exposes the
//    blocking api_message under X-API-KEY.
//
// 3. health() — light liveness check against GET /.
//
// Endpoint contracts (from agent-zero/api/api_message{,_async}.py + api_log_get.py):
//   POST {baseUrl}/api/api_message
//     headers:  X-API-KEY: <token>
//               Content-Type: application/json
//     body:     { message, context_id?, attachments?, project_name?,
//                 agent_profile?, lifetime_hours? }
//     ok:       { context_id, response }
//
//   POST {baseUrl}/api/api_message_async
//     same body as api_message
//     ok:       { message: "Message received.", context_id }     (fire-and-forget)
//
//   POST {baseUrl}/api/api_log_get
//     body:     { context_id, length? }
//     ok:       { context_id, log: { items: LogItem[], progress_active, ... } }
//
//   Error shape (all three): { error: string } with non-2xx status.

import type { AgentZeroGatewayConfig } from '../types';

export interface AgentZeroMessageRequest {
  /** User-facing message body. Required. */
  message: string;
  /** AZ chat context to continue. Omit for a new chat. */
  contextId?: string;
  /** Inline attachments (base64-encoded). */
  attachments?: Array<{ filename: string; base64: string }>;
  /** Switch active AZ project for this turn (analogous to `/project foo` in a0 CLI). */
  projectName?: string;
  /** Override the agent profile (e.g. `'helpful'`, `'catgirl'`). */
  agentProfile?: string;
  /** Context lifetime in hours (default 24 in AZ). */
  lifetimeHours?: number;
}

export interface AgentZeroMessageResponse {
  /** AZ chat context id — pass back on the next request to continue the conversation. */
  contextId: string;
  /** Final agent reply text. */
  response: string;
}

export class AgentZeroError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgentZeroError';
    this.status = status;
  }
}

/** Mirrors AZ's LogItem dict shape (helpers/log.py:LogItem.output()). */
export interface AgentZeroLogItem {
  /** Monotonic position in the context's log — use as your poll cursor. */
  no: number;
  /** AZ log entry id (UUID-ish). May be null for tombstone entries. */
  id: string | null;
  /** AZ log type: 'user', 'agent', 'tool', 'error', 'response', etc. */
  type: string;
  heading: string;
  content: string;
  /** AZ key/value pairs attached to the log (attachments, tool args, etc.). */
  kvps: Record<string, unknown> | null;
  /** Unix seconds (float). */
  timestamp: number;
  /** Multi-agent index (0 = root). */
  agentno: number;
}

export interface AgentZeroStreamOptions {
  /**
   * How often to poll /api/api_log_get for new items, ms. Default 400.
   * The AZ web UI polls every 500ms; 400 keeps mobile feeling snappy without
   * hammering loopback.
   */
  pollIntervalMs?: number;
  /**
   * Max number of items to ask AZ for per poll (window into the tail of the
   * log). Default 200 — enough for typical turns, small enough to stay cheap.
   */
  pollWindow?: number;
  /**
   * Hard cap on how long streamMessage will wait for a final response item,
   * ms. Default 5 minutes. Hitting this rejects with AgentZeroError(408).
   */
  maxStreamMs?: number;
}

export interface AgentZeroClientOptions {
  /** Base HTTP URL of the AZ instance, no trailing slash. */
  baseUrl: string;
  /** AZ auth token (the `X-API-KEY` header value — same string `create_auth_token()` produces). */
  token: string;
  /** Optional fetch impl override for tests. */
  fetchImpl?: typeof fetch;
}

export class AgentZeroClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly doFetch: typeof fetch;

  constructor(options: AgentZeroClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.token = options.token;
    this.doFetch = options.fetchImpl ?? fetch;
  }

  /**
   * Liveness check: GET / returns 200 (or 302 to login).
   * Anything else (or a network failure) → false.
   */
  async health(signal?: AbortSignal): Promise<boolean> {
    try {
      const res = await this.doFetch(`${this.baseUrl}/`, { method: 'GET', signal });
      return res.status === 200 || res.status === 302;
    } catch {
      return false;
    }
  }

  /**
   * Send one user turn. On success the caller MUST store `contextId` and pass
   * it back on the next call to continue the same AZ chat.
   *
   * Throws `AgentZeroError` for non-2xx responses (status is preserved) and
   * stdlib `Error` for shape problems.
   */
  async sendMessage(req: AgentZeroMessageRequest, signal?: AbortSignal): Promise<AgentZeroMessageResponse> {
    if (!req.message || !req.message.trim()) {
      throw new Error('message is required');
    }

    const body: Record<string, unknown> = { message: req.message };
    if (req.contextId !== undefined) body.context_id = req.contextId;
    if (req.attachments !== undefined) body.attachments = req.attachments;
    if (req.projectName !== undefined) body.project_name = req.projectName;
    if (req.agentProfile !== undefined) body.agent_profile = req.agentProfile;
    if (req.lifetimeHours !== undefined) body.lifetime_hours = req.lifetimeHours;

    const res = await this.doFetch(`${this.baseUrl}/api/api_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.token,
      },
      body: JSON.stringify(body),
      signal,
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // body wasn't JSON — fall through to status-based error
    }

    if (!res.ok) {
      const errMsg = (data as { error?: unknown } | null)?.error;
      throw new AgentZeroError(
        typeof errMsg === 'string' && errMsg ? errMsg : `HTTP ${res.status}`,
        res.status,
      );
    }

    if (!data || typeof data !== 'object' || !('context_id' in data) || !('response' in data)) {
      throw new Error('Invalid Agent Zero response shape — missing context_id or response');
    }

    return {
      contextId: String((data as { context_id: unknown }).context_id),
      response: String((data as { response: unknown }).response),
    };
  }

  /**
   * Start an AZ turn and stream the agent's log items as they happen.
   *
   * Flow:
   *   1. POST /api/api_message_async to kick the agent off and capture its
   *      `context_id` immediately (no waiting for the final answer).
   *   2. Poll /api/api_log_get every `pollIntervalMs` ms, emit each new log
   *      item via `onLogItem`. Stop when `progress_active=false` AND we
   *      received a `type === 'response'` item.
   *
   * Resolves with `{ contextId, response }`. The `response` is the content of
   * the last `type === 'response'` log item (matches what sendMessage would
   * have returned synchronously).
   *
   * Errors:
   *   - kickoff failure (4xx/5xx on api_message_async) → rejects synchronously
   *   - transient polling errors → swallowed, next tick retries
   *   - timeout watchdog (no response item within `maxStreamMs`, default 5min)
   *     → rejects with AgentZeroError(status 408)
   *   - signal abort → rejects with the abort reason
   */
  async streamMessage(
    req: AgentZeroMessageRequest,
    onLogItem: (item: AgentZeroLogItem) => void,
    options: AgentZeroStreamOptions = {},
    signal?: AbortSignal,
  ): Promise<AgentZeroMessageResponse> {
    if (!req.message || !req.message.trim()) {
      throw new Error('message is required');
    }
    const pollIntervalMs = options.pollIntervalMs ?? 400;
    const pollWindow = options.pollWindow ?? 200;
    const maxStreamMs = options.maxStreamMs ?? 5 * 60_000;

    // Phase 1: kickoff
    const kickoffBody: Record<string, unknown> = { message: req.message };
    if (req.contextId !== undefined) kickoffBody.context_id = req.contextId;
    if (req.attachments !== undefined) kickoffBody.attachments = req.attachments;
    if (req.projectName !== undefined) kickoffBody.project_name = req.projectName;
    if (req.agentProfile !== undefined) kickoffBody.agent_profile = req.agentProfile;
    if (req.lifetimeHours !== undefined) kickoffBody.lifetime_hours = req.lifetimeHours;

    const kickoffRes = await this.doFetch(`${this.baseUrl}/api/api_message_async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.token,
      },
      body: JSON.stringify(kickoffBody),
      signal,
    });
    const kickoffText = await kickoffRes.text();
    let kickoffData: unknown = null;
    try {
      kickoffData = kickoffText ? JSON.parse(kickoffText) : null;
    } catch {
      // fall through
    }
    if (!kickoffRes.ok) {
      const errMsg = (kickoffData as { error?: unknown } | null)?.error;
      throw new AgentZeroError(
        typeof errMsg === 'string' && errMsg ? errMsg : `HTTP ${kickoffRes.status}`,
        kickoffRes.status,
      );
    }
    const ctxId = (kickoffData as { context_id?: unknown } | null)?.context_id;
    if (typeof ctxId !== 'string' || !ctxId) {
      throw new Error('Invalid Agent Zero kickoff response — missing context_id');
    }

    // Phase 2: poll until the agent emits a 'response' item AND goes idle.
    const startedAt = Date.now();
    let highWater = -1;
    let finalResponse: string | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) {
        throw signal.reason ?? new Error('aborted');
      }
      if (Date.now() - startedAt > maxStreamMs) {
        throw new AgentZeroError(
          `Streaming timeout: no response within ${maxStreamMs}ms`,
          408,
        );
      }

      let snapshot: { items: AgentZeroLogItem[]; progressActive: boolean };
      try {
        snapshot = await this.fetchLog(ctxId, pollWindow, signal);
      } catch {
        // transient — back off and retry
        await sleep(pollIntervalMs, signal);
        continue;
      }

      for (const item of snapshot.items) {
        if (item.no > highWater) {
          highWater = item.no;
          onLogItem(item);
          if (item.type === 'response') {
            finalResponse = item.content;
          }
        }
      }

      if (!snapshot.progressActive && finalResponse !== null) {
        return { contextId: ctxId, response: finalResponse };
      }

      await sleep(pollIntervalMs, signal);
    }
  }

  private async fetchLog(
    contextId: string,
    length: number,
    signal?: AbortSignal,
  ): Promise<{ items: AgentZeroLogItem[]; progressActive: boolean }> {
    const res = await this.doFetch(`${this.baseUrl}/api/api_log_get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.token,
      },
      body: JSON.stringify({ context_id: contextId, length }),
      signal,
    });
    if (!res.ok) {
      throw new AgentZeroError(`HTTP ${res.status}`, res.status);
    }
    const data = await res.json().catch(() => null) as unknown;
    const log = (data as { log?: unknown } | null)?.log as
      | { items?: unknown; progress_active?: unknown }
      | undefined;
    if (!log || !Array.isArray(log.items)) {
      throw new Error('Invalid Agent Zero log response shape');
    }
    return {
      items: (log.items as unknown[]).filter(isLogItem),
      progressActive: Boolean(log.progress_active),
    };
  }
}

function isLogItem(value: unknown): value is AgentZeroLogItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.no === 'number'
    && typeof v.type === 'string'
    && typeof v.heading === 'string'
    && typeof v.content === 'string';
}

/** Promise-based sleep that respects an AbortSignal. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    signal?.addEventListener('abort', onAbort);
  });
}

/** Convenience factory that pulls baseUrl from an AgentZeroGatewayConfig. */
export function createAgentZeroClient(
  config: AgentZeroGatewayConfig,
  token: string,
  fetchImpl?: typeof fetch,
): AgentZeroClient {
  return new AgentZeroClient({ baseUrl: config.bridgeUrl, token, fetchImpl });
}
