import { normalizeProviderInfo, extractModels } from './gateway-backend-operations';

/**
 * 🧪 The Battle-Testing Arena — Where Snake_case Meets Its Camel Match
 *
 * These tests guard the Hermes-native compatibility layer. The Hermes bridge
 * emits provider objects in snake_case (is_current, total_models, api_url),
 * while our TypeScript types expect camelCase. If normalization breaks, the
 * model picker silently shows "No models available" — the exact bug we're
 * battle-proofing against. 🛡️
 */
describe('normalizeProviderInfo', () => {
  it('translates snake_case Hermes provider fields to camelCase', () => {
    // 🐍 A raw provider straight from the Hermes bridge's serpentine mouth
    const hermesRaw = {
      slug: 'nvidia',
      name: 'Nvidia',
      is_current: true,
      total_models: 48,
      api_url: 'https://integrate.api.nvidia.com/v1',
      models: ['nemotron-3', 'nemotron-4'],
      source: 'credential-pool',
    };

    expect(normalizeProviderInfo(hermesRaw)).toEqual({
      slug: 'nvidia',
      name: 'Nvidia',
      isCurrent: true,
      totalModels: 48,
      apiUrl: 'https://integrate.api.nvidia.com/v1',
      models: ['nemotron-3', 'nemotron-4'],
      source: 'credential-pool',
    });
  });

  it('passes through already-camelCase providers unchanged', () => {
    // 🐫 A provider that already speaks our noble camel tongue
    const camelRaw = {
      slug: 'openai-codex',
      name: 'OpenAI Codex',
      isCurrent: false,
      totalModels: 3,
      apiUrl: 'https://api.openai.com/v1',
      models: ['gpt-5.3-codex'],
    };

    expect(normalizeProviderInfo(camelRaw)).toMatchObject({
      slug: 'openai-codex',
      name: 'OpenAI Codex',
      isCurrent: false,
      totalModels: 3,
      apiUrl: 'https://api.openai.com/v1',
      models: ['gpt-5.3-codex'],
    });
  });

  it('falls back to base_url and baseUrl when api_url is absent', () => {
    expect(normalizeProviderInfo({ slug: 'x', base_url: 'https://b/v1' }).apiUrl).toBe('https://b/v1');
    expect(normalizeProviderInfo({ slug: 'y', baseUrl: 'https://c/v1' }).apiUrl).toBe('https://c/v1');
  });

  it('derives totalModels from the models array length when no count is given', () => {
    const result = normalizeProviderInfo({ slug: 'z', models: ['a', 'b', 'c'] });
    expect(result.totalModels).toBe(3);
  });

  it('coerces non-string model entries to strings defensively', () => {
    // 🌩️ A malformed payload should never crash the picker
    const result = normalizeProviderInfo({ slug: 'weird', models: [1, 2, null] });
    expect(result.models).toEqual(['1', '2', 'null']);
  });

  it('returns a safe Unknown Provider for null/undefined/non-object input', () => {
    const safe = { slug: '', name: 'Unknown Provider', isCurrent: false, models: [], totalModels: 0 };
    expect(normalizeProviderInfo(null)).toEqual(safe);
    expect(normalizeProviderInfo(undefined)).toEqual(safe);
    expect(normalizeProviderInfo('not-an-object')).toEqual(safe);
    expect(normalizeProviderInfo(42)).toEqual(safe);
  });

  it('uses slug as the display name when name is missing', () => {
    expect(normalizeProviderInfo({ slug: 'huggingface' }).name).toBe('huggingface');
    expect(normalizeProviderInfo({ provider_slug: 'gemini' }).name).toBe('gemini');
  });

  it('handles provider_slug as an alternative slug source', () => {
    expect(normalizeProviderInfo({ provider_slug: 'copilot' }).slug).toBe('copilot');
  });
});

describe('extractModels', () => {
  it('unwraps the { models: [...] } response shape', () => {
    const models = [{ id: 'a', name: 'a', provider: 'p' }];
    expect(extractModels({ models }, 'models')).toBe(models);
  });

  it('passes through a bare array response unchanged', () => {
    // 🌐 Some backends return the array directly, without a wrapper
    const bare = [{ id: 'b', name: 'b', provider: 'p' }];
    expect(extractModels(bare, 'models')).toBe(bare);
  });

  it('returns an empty array for null, undefined, or wrong-shaped input', () => {
    expect(extractModels(null)).toEqual([]);
    expect(extractModels(undefined)).toEqual([]);
    expect(extractModels({ notModels: [1, 2] })).toEqual([]);
    expect(extractModels('string')).toEqual([]);
    expect(extractModels(123)).toEqual([]);
  });

  it('respects a custom key for extraction', () => {
    const providers = [{ slug: 'p' }];
    expect(extractModels({ providers }, 'providers')).toBe(providers);
  });

  it('returns empty array when the keyed value is not an array', () => {
    expect(extractModels({ models: 'oops' }, 'models')).toEqual([]);
    expect(extractModels({ models: { id: 'x' } }, 'models')).toEqual([]);
  });
});
