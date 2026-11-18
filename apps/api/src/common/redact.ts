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
const SECRET_VALUE = /(ags_[A-Za-z0-9]+|sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|[A-Za-z0-9+/]{40,}={0,2})/g;

export function redactText(value: string): string {
  return value
    .slice(0, 2000)
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTED]@')
    .replace(/authorization\s*[:=]\s*bearer\s+[^\s,;]+/gi, '[REDACTED]')
    .replace(/((?:token|secret|password|passwd|api[_-]?key)=)[^&\s,;]+/gi, '$1[REDACTED]')
    .replace(SECRET_VALUE, '[REDACTED]');
}

export function redactStrings<T>(input: T, seen = new WeakSet<object>()): T {
  if (typeof input === 'string') {
    return redactText(input) as T;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input;
  }
  if (seen.has(input)) {
    return '[Circular]' as T;
  }
  seen.add(input);
  if (Array.isArray(input)) {
    return input.map((entry) => redactStrings(entry, seen)) as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    result[key] = redactStrings(value, seen);
  }
  return result as T;
}

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
