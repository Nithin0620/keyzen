import { beforeEach, describe, expect, it, vi } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

import { validatePublicWebhookUrl } from './url-validation';

describe('validatePublicWebhookUrl', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('allows a public HTTPS endpoint', async () => {
    const url = await validatePublicWebhookUrl('https://hooks.example.com/aegis');
    expect(url.hostname).toBe('hooks.example.com');
  });

  it.each([
    'http://hooks.example.com',
    'https://user:pass@hooks.example.com',
    'https://hooks.example.com/#fragment',
    'https://hooks.example.com:8443',
    'https://localhost',
    'https://service.localhost',
    'https://metadata.google.internal',
    'https://127.0.0.1',
    'https://10.0.0.5',
    'https://169.254.169.254',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
  ])('rejects unsafe URL %s', async (input) => {
    await expect(validatePublicWebhookUrl(input)).rejects.toThrow();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private address', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '192.168.1.10', family: 4 }]);
    await expect(validatePublicWebhookUrl('https://hooks.example.com')).rejects.toThrow(
      'Webhook URL resolves to a private address'
    );
  });

  it('rejects DNS resolution failures', async () => {
    lookupMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    await expect(validatePublicWebhookUrl('https://hooks.example.com')).rejects.toThrow(
      'Webhook URL host could not be resolved'
    );
  });
});
