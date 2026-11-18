import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { BadRequestException } from '../common/http-error';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

function ipv4Value(address: string): number {
  const parts = address.split('.').map(Number);
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inRange(address: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Value(address) & mask) === (ipv4Value(base) & mask);
}

function isPrivateIPv4(address: string): boolean {
  return (
    inRange(address, '0.0.0.0', 8) ||
    inRange(address, '10.0.0.0', 8) ||
    inRange(address, '100.64.0.0', 10) ||
    inRange(address, '127.0.0.0', 8) ||
    inRange(address, '169.254.0.0', 16) ||
    inRange(address, '172.16.0.0', 12) ||
    inRange(address, '192.0.0.0', 24) ||
    inRange(address, '192.0.2.0', 24) ||
    inRange(address, '192.168.0.0', 16) ||
    inRange(address, '198.18.0.0', 15) ||
    inRange(address, '198.51.100.0', 24) ||
    inRange(address, '203.0.113.0', 24) ||
    inRange(address, '224.0.0.0', 4) ||
    inRange(address, '240.0.0.0', 4)
  );
}

function mappedIPv4(address: string): string | null {
  const ipv4Literal = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (ipv4Literal) {
    return ipv4Literal.slice(1).join('.');
  }
  const hexGroups = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
  if (!hexGroups) {
    return null;
  }
  const high = parseInt(hexGroups[1], 16);
  const low = parseInt(hexGroups[2], 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mapped = mappedIPv4(normalized);
  if (mapped) {
    return isPrivateIPv4(mapped);
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8') ||
    normalized.startsWith('100::')
  );
}

function isBlockedAddress(address: string): boolean {
  return isIP(address) === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
}

function normalizeHost(input: string): string {
  return input.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function validateUrlShape(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadRequestException('Webhook URL is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new BadRequestException('Webhook URL must be an HTTPS URL without credentials or fragments');
  }
  if (url.port && url.port !== '443') {
    throw new BadRequestException('Webhook URL port is not allowed');
  }
  const host = normalizeHost(url.hostname);
  if (!host || host.includes('%') || BLOCKED_HOSTS.has(host) || host.endsWith('.localhost')) {
    throw new BadRequestException('Webhook URL host is not allowed');
  }
  if (!isIP(host)) {
    url.hostname = host;
  }
  return url;
}

export async function validatePublicWebhookUrl(input: string): Promise<URL> {
  const url = validateUrlShape(input);
  const host = normalizeHost(url.hostname);
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new BadRequestException('Webhook URL resolves to a private address');
    }
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException('Webhook URL host could not be resolved');
  }
  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new BadRequestException('Webhook URL resolves to a private address');
  }
  return url;
}
