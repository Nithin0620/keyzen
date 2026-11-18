const SAFE_ID_KEYS = new Set([
  'actorId',
  'environmentId',
  'projectId',
  'secretId',
  'sessionId',
  'tokenId',
  'userId',
  'workspaceId',
]);

const SENSITIVE_KEY = /(value|values|password|passwd|token|secret|authorization|cookie|cipher|authTag|key|credentials?|apiKey)/i;

export function redactSensitive<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((entry) => redactSensitive(entry)) as T;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!SAFE_ID_KEYS.has(key) && SENSITIVE_KEY.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = redactSensitive(value);
  }
  return result as T;
}
