export const MAX_ENV_BYTES = 256 * 1024;
export const MAX_ENV_KEYS = 500;
export const MAX_ENV_VALUE_BYTES = 64 * 1024;

export interface EnvEntry {
  name: string;
  value: string;
}

export class EnvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvParseError';
  }
}

const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

function invalid(line: number): EnvParseError {
  return new EnvParseError(`Invalid .env entry at line ${line}`);
}

function parseQuotedValue(value: string, line: number): string {
  const quote = value[0];
  if (value.length < 2 || value[value.length - 1] !== quote) {
    throw invalid(line);
  }
  const body = value.slice(1, -1);
  if (quote === "'") {
    if (body.includes("'")) {
      throw invalid(line);
    }
    return body;
  }
  let result = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char !== '\\') {
      result += char;
      continue;
    }
    const next = body[index + 1];
    const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' };
    if (!next || !(next in escapes)) {
      throw invalid(line);
    }
    result += escapes[next];
    index += 1;
  }
  return result;
}

export function parseEnvContent(content: string): EnvEntry[] {
  if (Buffer.byteLength(content, 'utf8') > MAX_ENV_BYTES) {
    throw new EnvParseError('.env content exceeds size limit');
  }
  const entries: EnvEntry[] = [];
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index].trim();
    if (!raw || raw.startsWith('#')) {
      continue;
    }
    const line = raw.replace(/^export\s+/, '');
    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw invalid(lineNumber);
    }
    const name = line.slice(0, separator).trim();
    if (!ENV_NAME.test(name)) {
      throw invalid(lineNumber);
    }
    if (seen.has(name)) {
      throw new EnvParseError(`Duplicate .env key at line ${lineNumber}`);
    }
    const rawValue = line.slice(separator + 1).trim();
    if (!rawValue) {
      throw invalid(lineNumber);
    }
    const value = rawValue.startsWith('"') || rawValue.startsWith("'")
      ? parseQuotedValue(rawValue, lineNumber)
      : rawValue;
    if (!value || rawValue.includes('#') || Buffer.byteLength(value, 'utf8') > MAX_ENV_VALUE_BYTES) {
      throw invalid(lineNumber);
    }
    seen.add(name);
    entries.push({ name, value });
  }
  if (entries.length === 0) {
    throw new EnvParseError('.env content contains no entries');
  }
  if (entries.length > MAX_ENV_KEYS) {
    throw new EnvParseError('.env content exceeds key limit');
  }
  return entries;
}
