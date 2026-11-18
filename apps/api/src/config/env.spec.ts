import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://localhost:27017/aegis',
  WEB_ORIGIN: 'https://app.example.com',
  ENFORCE_TLS: 'true',
  TRUST_PROXY: '1',
  SENTRY_DSN: 'https://public@sentry.example.com/1',
  AEGIS_MASTER_KEY: 'a'.repeat(32),
  RESEND_API_KEY: 're_test_key',
  OPS_ALERT_EMAIL: 'ops@example.com',
  WEBHOOK_SECRET_ENCRYPTION_KEY: 'b'.repeat(32),
  STRIPE_SECRET_KEY: 'sk_test_key',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PRICE_PRO: 'price_pro',
  STRIPE_PRICE_ENTERPRISE: 'price_enterprise',
  AUTH_SECRET: 'c'.repeat(32),
};

describe('env validation', () => {
  it('accepts a hardened production configuration', () => {
    expect(parseEnv(BASE_ENV).ENFORCE_TLS).toBe(true);
  });

  it('rejects insecure production transport settings', () => {
    expect(() => parseEnv({ ...BASE_ENV, ENFORCE_TLS: 'false' })).toThrowError(/ENFORCE_TLS/);
    expect(() => parseEnv({ ...BASE_ENV, TRUST_PROXY: '0' })).toThrowError(/TRUST_PROXY/);
    expect(() => parseEnv({ ...BASE_ENV, WEB_ORIGIN: 'http://app.example.com' })).toThrowError(/HTTPS/);
    expect(() => parseEnv({ ...BASE_ENV, SENTRY_DSN: undefined })).toThrowError(/SENTRY_DSN/);
  });

  it('validates optional origins and observability settings', () => {
    expect(() =>
      parseEnv({ ...BASE_ENV, WEB_ORIGINS: 'https://admin.example.com/, https://ops.example.com' })
    ).not.toThrow();
    expect(() => parseEnv({ ...BASE_ENV, WEB_ORIGINS: 'https://admin.example.com/path' })).toThrowError(
      /WEB_ORIGINS/
    );
    expect(() => parseEnv({ ...BASE_ENV, WEB_ORIGINS: 'https://user:pass@admin.example.com' })).toThrowError(
      /WEB_ORIGINS/
    );
    expect(() => parseEnv({ ...BASE_ENV, WEB_ORIGINS: 'http://admin.example.com' })).toThrowError(/HTTPS/);
    expect(() => parseEnv({ ...BASE_ENV, OTEL_ENABLED: 'true' })).toThrowError(/OTEL_EXPORTER_OTLP_ENDPOINT/);
    expect(
      parseEnv({
        ...BASE_ENV,
        OTEL_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.com/v1/traces',
      }).OTEL_ENABLED
    ).toBe(true);
  });
});
