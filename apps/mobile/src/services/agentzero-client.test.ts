import { AgentZeroClient, AgentZeroError, createAgentZeroClient } from './agentzero-client';

type MockFetchCall = { url: string; init: RequestInit };

function buildMockFetch(
  responder: (req: MockFetchCall) => { status: number; bodyJson?: unknown; bodyText?: string },
): {
  fetchImpl: typeof fetch;
  calls: MockFetchCall[];
} {
  const calls: MockFetchCall[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init: RequestInit = {}) => {
    const call: MockFetchCall = { url: String(url), init };
    calls.push(call);
    const { status, bodyJson, bodyText } = responder(call);
    const body = bodyText ?? (bodyJson !== undefined ? JSON.stringify(bodyJson) : '');
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
      // The client uses text() not json(), but provide json() for completeness.
      json: async () => (bodyJson !== undefined ? bodyJson : JSON.parse(body)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('AgentZeroClient', () => {
  describe('sendMessage', () => {
    it('POSTs JSON to /api/api_message with X-API-KEY header and parses the response', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({
        status: 200,
        bodyJson: { context_id: 'ctx-1', response: 'pong' },
      }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az.example.com:5000',
        token: 'tok-123',
        fetchImpl,
      });

      const out = await client.sendMessage({ message: 'ping' });

      expect(out).toEqual({ contextId: 'ctx-1', response: 'pong' });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('http://az.example.com:5000/api/api_message');
      expect(calls[0].init.method).toBe('POST');
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-API-KEY']).toBe('tok-123');
      expect(JSON.parse(String(calls[0].init.body))).toEqual({ message: 'ping' });
    });

    it('strips trailing slashes from the baseUrl so /api/api_message is well-formed', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({
        status: 200,
        bodyJson: { context_id: 'c', response: 'r' },
      }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az.example.com:5000///',
        token: 't',
        fetchImpl,
      });

      await client.sendMessage({ message: 'hi' });
      expect(calls[0].url).toBe('http://az.example.com:5000/api/api_message');
    });

    it('threads contextId, projectName, agentProfile, lifetimeHours through the body', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({
        status: 200,
        bodyJson: { context_id: 'ctx-2', response: 'ok' },
      }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az',
        token: 't',
        fetchImpl,
      });

      await client.sendMessage({
        message: 'hi',
        contextId: 'ctx-2',
        projectName: 'demo',
        agentProfile: 'catgirl',
        lifetimeHours: 1,
        attachments: [{ filename: 'a.txt', base64: 'aGk=' }],
      });

      expect(JSON.parse(String(calls[0].init.body))).toEqual({
        message: 'hi',
        context_id: 'ctx-2',
        project_name: 'demo',
        agent_profile: 'catgirl',
        lifetime_hours: 1,
        attachments: [{ filename: 'a.txt', base64: 'aGk=' }],
      });
    });

    it('omits optional fields entirely when not provided (no nulls)', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({
        status: 200,
        bodyJson: { context_id: 'c', response: 'r' },
      }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az',
        token: 't',
        fetchImpl,
      });

      await client.sendMessage({ message: 'hi' });
      const body = JSON.parse(String(calls[0].init.body));
      expect(Object.keys(body).sort()).toEqual(['message']);
    });

    it('throws AgentZeroError with the server-provided error message and HTTP status on 4xx', async () => {
      const { fetchImpl } = buildMockFetch(() => ({
        status: 404,
        bodyJson: { error: 'Context not found' },
      }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az',
        token: 't',
        fetchImpl,
      });

      await expect(client.sendMessage({ message: 'hi', contextId: 'ctx-x' })).rejects.toMatchObject({
        name: 'AgentZeroError',
        message: 'Context not found',
        status: 404,
      });
    });

    it('throws AgentZeroError with a synthetic message when the server returns no body', async () => {
      const { fetchImpl } = buildMockFetch(() => ({ status: 500, bodyText: '' }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az',
        token: 't',
        fetchImpl,
      });

      await expect(client.sendMessage({ message: 'hi' })).rejects.toMatchObject({
        name: 'AgentZeroError',
        message: 'HTTP 500',
        status: 500,
      });
    });

    it('rejects when the success body is missing context_id or response', async () => {
      const { fetchImpl } = buildMockFetch(() => ({ status: 200, bodyJson: { context_id: 'x' } }));
      const client = new AgentZeroClient({
        baseUrl: 'http://az',
        token: 't',
        fetchImpl,
      });

      await expect(client.sendMessage({ message: 'hi' })).rejects.toThrow(
        /Invalid Agent Zero response shape/,
      );
    });

    it('rejects empty messages without making a request', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({ status: 200, bodyJson: {} }));
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(client.sendMessage({ message: '   ' })).rejects.toThrow('message is required');
      expect(calls).toHaveLength(0);
    });
  });

  describe('health', () => {
    it.each([200, 302])('returns true on HTTP %i', async (status) => {
      const { fetchImpl } = buildMockFetch(() => ({ status }));
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(client.health()).resolves.toBe(true);
    });

    it('returns false on a non-2xx/302 status', async () => {
      const { fetchImpl } = buildMockFetch(() => ({ status: 500 }));
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(client.health()).resolves.toBe(false);
    });

    it('returns false when fetch throws (network down, abort)', async () => {
      const fetchImpl = (async () => {
        throw new Error('network down');
      }) as unknown as typeof fetch;
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(client.health()).resolves.toBe(false);
    });
  });

  describe('createAgentZeroClient factory', () => {
    it('creates a client bound to the gateway config bridgeUrl', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({
        status: 200,
        bodyJson: { context_id: 'c', response: 'r' },
      }));
      const client = createAgentZeroClient(
        { bridgeUrl: 'http://az.example.com:5000', displayName: 'Habitat AZ' },
        'tok-via-factory',
        fetchImpl,
      );
      await client.sendMessage({ message: 'hi' });
      expect(calls[0].url).toBe('http://az.example.com:5000/api/api_message');
      expect((calls[0].init.headers as Record<string, string>)['X-API-KEY']).toBe('tok-via-factory');
    });
  });

  it('exports a named AgentZeroError class for instanceof checks at call sites', () => {
    expect(new AgentZeroError('x', 503)).toBeInstanceOf(Error);
    expect(new AgentZeroError('x', 503).status).toBe(503);
    expect(new AgentZeroError('x', 503).name).toBe('AgentZeroError');
  });

  describe('streamMessage', () => {
    function logItem(no: number, type: string, content: string): Record<string, unknown> {
      return { no, id: `id-${no}`, type, heading: '', content, kvps: null, timestamp: 0, agentno: 0 };
    }

    it('kicks off via /api/api_message_async, polls /api/api_log_get, emits items, resolves with final response', async () => {
      // Sequential responder: kickoff first, then 2 polls (still active, then done with response item).
      let callIdx = 0;
      const { fetchImpl, calls } = buildMockFetch(() => {
        callIdx += 1;
        if (callIdx === 1) {
          return { status: 200, bodyJson: { message: 'received', context_id: 'ctx-async' } };
        }
        if (callIdx === 2) {
          return {
            status: 200,
            bodyJson: {
              context_id: 'ctx-async',
              log: {
                items: [logItem(0, 'user', 'hi'), logItem(1, 'agent', 'thinking...')],
                progress_active: true,
              },
            },
          };
        }
        return {
          status: 200,
          bodyJson: {
            context_id: 'ctx-async',
            log: {
              items: [
                logItem(0, 'user', 'hi'),
                logItem(1, 'agent', 'thinking...'),
                logItem(2, 'response', 'done!'),
              ],
              progress_active: false,
            },
          },
        };
      });
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      const seen: string[] = [];
      const out = await client.streamMessage(
        { message: 'go' },
        (item) => { seen.push(`${item.type}:${item.content}`); },
        { pollIntervalMs: 1 }, // jest doesn't need real sleeps
      );

      expect(out).toEqual({ contextId: 'ctx-async', response: 'done!' });
      // Each item should be emitted exactly once, in order.
      expect(seen).toEqual(['user:hi', 'agent:thinking...', 'response:done!']);
      // First call was the async kickoff.
      expect(calls[0].url).toBe('http://az/api/api_message_async');
      // Subsequent calls are log polls.
      expect(calls.slice(1).every((c) => c.url === 'http://az/api/api_log_get')).toBe(true);
    });

    it('threads contextId through the kickoff body when continuing an existing chat', async () => {
      let callIdx = 0;
      const { fetchImpl, calls } = buildMockFetch(() => {
        callIdx += 1;
        if (callIdx === 1) {
          return { status: 200, bodyJson: { message: 'received', context_id: 'ctx-existing' } };
        }
        return {
          status: 200,
          bodyJson: {
            context_id: 'ctx-existing',
            log: { items: [logItem(0, 'response', 'ok')], progress_active: false },
          },
        };
      });
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });

      await client.streamMessage(
        { message: 'follow-up', contextId: 'ctx-existing' },
        () => {},
        { pollIntervalMs: 1 },
      );

      const kickoffBody = JSON.parse(String(calls[0].init.body));
      expect(kickoffBody).toEqual({ message: 'follow-up', context_id: 'ctx-existing' });
    });

    it('throws AgentZeroError synchronously when the async kickoff fails', async () => {
      const { fetchImpl } = buildMockFetch(() => ({
        status: 401,
        bodyJson: { error: 'Invalid API key' },
      }));
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 'bad', fetchImpl });

      await expect(
        client.streamMessage({ message: 'hi' }, () => {}, { pollIntervalMs: 1 }),
      ).rejects.toMatchObject({ name: 'AgentZeroError', status: 401, message: 'Invalid API key' });
    });

    it('does not emit the same log item twice across poll ticks', async () => {
      let callIdx = 0;
      const item0 = logItem(0, 'agent', 'still working');
      const item1 = logItem(1, 'response', 'final answer');
      const { fetchImpl } = buildMockFetch(() => {
        callIdx += 1;
        if (callIdx === 1) {
          return { status: 200, bodyJson: { message: 'received', context_id: 'c' } };
        }
        if (callIdx === 2) {
          return {
            status: 200,
            bodyJson: { context_id: 'c', log: { items: [item0], progress_active: true } },
          };
        }
        // Tick 3 also returns item0 (no progress) then tick 4 adds item1 + closes.
        if (callIdx === 3) {
          return {
            status: 200,
            bodyJson: { context_id: 'c', log: { items: [item0], progress_active: true } },
          };
        }
        return {
          status: 200,
          bodyJson: { context_id: 'c', log: { items: [item0, item1], progress_active: false } },
        };
      });
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });

      const seen: number[] = [];
      const out = await client.streamMessage(
        { message: 'go' },
        (it) => { seen.push(it.no); },
        { pollIntervalMs: 1 },
      );
      expect(seen).toEqual([0, 1]);
      expect(out.response).toBe('final answer');
    });

    it('rejects with AgentZeroError(408) when no response arrives within maxStreamMs', async () => {
      let callIdx = 0;
      const { fetchImpl } = buildMockFetch(() => {
        callIdx += 1;
        if (callIdx === 1) {
          return { status: 200, bodyJson: { message: 'received', context_id: 'c' } };
        }
        // Endless work, never a response, never goes idle.
        return {
          status: 200,
          bodyJson: { context_id: 'c', log: { items: [logItem(0, 'agent', 'hmm')], progress_active: true } },
        };
      });
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(
        client.streamMessage({ message: 'go' }, () => {}, { pollIntervalMs: 1, maxStreamMs: 5 }),
      ).rejects.toMatchObject({ name: 'AgentZeroError', status: 408 });
    });

    it('rejects empty messages without making a request', async () => {
      const { fetchImpl, calls } = buildMockFetch(() => ({ status: 200, bodyJson: {} }));
      const client = new AgentZeroClient({ baseUrl: 'http://az', token: 't', fetchImpl });
      await expect(client.streamMessage({ message: '' }, () => {})).rejects.toThrow('message is required');
      expect(calls).toHaveLength(0);
    });
  });
});
