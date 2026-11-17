export function maskSecretValue(value: string): string {
  if (value.length <= 8) {
    return '•'.repeat(value.length);
  }
  const dots = '•'.repeat(Math.min(8, value.length - 4));
  return `${value.slice(0, 2)}${dots}${value.slice(-2)}`;
}
