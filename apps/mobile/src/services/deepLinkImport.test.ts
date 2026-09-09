import { parseImportText, isConnectInviteUrl } from './deepLinkImport';

describe('parseImportText', () => {
  describe('clawket:// deep links', () => {
    it('parses a connect invite with url and token', () => {
      const result = parseImportText(
        'clawket://connect?url=ws://192.168.1.20:4319/v1/hermes/ws&token=tok-abc'
      );
      expect(result).toEqual({
        url: 'ws://192.168.1.20:4319/v1/hermes/ws',
        token: 'tok-abc',
        password: undefined,
      });
    });

    it('parses a connect invite with password', () => {
      const result = parseImportText(
        'clawket://connect?url=ws://192.168.1.20:4319&password=pass-123'
      );
      expect(result).toEqual({
        url: 'ws://192.168.1.20:4319',
        token: undefined,
        password: 'pass-123',
      });
    });

    it('rejects non-connect clawket routes', () => {
      expect(parseImportText('clawket://config')).toBeNull();
      expect(parseImportText('clawket://agent?message=hello')).toBeNull();
    });
  });

  describe('QR payload text', () => {
    it('parses a JSON gateway payload', () => {
      const result = parseImportText(JSON.stringify({
        url: 'ws://192.168.1.20:4319',
        token: 'tok-abc',
      }));
      expect(result).not.toBeNull();
      expect(result?.url).toBe('ws://192.168.1.20:4319');
      expect(result?.token).toBe('tok-abc');
    });

    it('parses an openclaw:// connect URL', () => {
      const result = parseImportText('openclaw://connect?host=192.168.1.20&port=4319&token=tok-abc');
      expect(result).not.toBeNull();
      expect(result?.url).toBe('ws://192.168.1.20:4319');
      expect(result?.token).toBe('tok-abc');
    });

    it('parses a Hermes local pairing payload', () => {
      const result = parseImportText(JSON.stringify({
        kind: 'clawket_hermes_local',
        version: 1,
        url: 'ws://192.168.1.20:4319/v1/hermes/ws?token=tok-abc',
        hermes: { bridgeUrl: 'ws://192.168.1.20:4319/v1/hermes/ws?token=tok-abc' },
      }));
      expect(result?.backendKind).toBe('hermes');
      expect(result?.transportKind).toBe('local');
    });
  });

  describe('invalid input', () => {
    it('returns null for empty and whitespace text', () => {
      expect(parseImportText('')).toBeNull();
      expect(parseImportText('   ')).toBeNull();
    });

    it('returns null for garbage text', () => {
      expect(parseImportText('not a pairing invite')).toBeNull();
      expect(parseImportText('https://example.com/random')).toBeNull();
    });
  });
});

describe('isConnectInviteUrl', () => {
  it('is true for connect invites', () => {
    expect(isConnectInviteUrl('clawket://connect?url=x')).toBe(true);
  });

  it('is false for other routes and non-clawket urls', () => {
    expect(isConnectInviteUrl('clawket://config')).toBe(false);
    expect(isConnectInviteUrl('https://example.com')).toBe(false);
  });
});