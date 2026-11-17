function containsUnsafeKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsUnsafeKey);
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).some(([key, nested]) => {
      return key.startsWith('$') || key.includes('.') || containsUnsafeKey(nested);
    });
  }
  return false;
}

export class UnsafeInputError extends Error {
  constructor() {
    super('Unsafe input key detected');
    this.name = 'UnsafeInputError';
  }
}

export function assertSafeInput(value: unknown): void {
  if (containsUnsafeKey(value)) {
    throw new UnsafeInputError();
  }
}
