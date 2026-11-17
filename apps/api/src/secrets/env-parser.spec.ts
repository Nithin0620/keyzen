import { describe, expect, it } from 'vitest';
import { EnvParseError, MAX_ENV_KEYS, parseEnvContent } from './env-parser';

describe('parseEnvContent', () => {
  it('parses comments, export prefixes and quoted values without logging values', () => {
    expect(
      parseEnvContent("# comment\n\nexport API_KEY = \"line\\nvalue\"\nPLAIN=value\nQUOTED='literal'\n")
    ).toEqual([
      { name: 'API_KEY', value: 'line\nvalue' },
      { name: 'PLAIN', value: 'value' },
      { name: 'QUOTED', value: 'literal' },
    ]);
  });

  it('rejects malformed, duplicate and oversized entries without including values', () => {
    expect(() => parseEnvContent('BAD')).toThrow(EnvParseError);
    expect(() => parseEnvContent('KEY=value\nKEY=other')).toThrow(/Duplicate/);
    expect(() => parseEnvContent('KEY=value # comment')).toThrow(/Invalid/);
    const many = Array.from({ length: MAX_ENV_KEYS + 1 }, (_, index) => `KEY_${index}=value`).join('\n');
    expect(() => parseEnvContent(many)).toThrow(/exceeds key limit/);
  });
});
