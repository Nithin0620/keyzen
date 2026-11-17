export interface KeyZenOptions {
  projectId: string;
  environment: string;
  apiKey?: string;
  endpoint?: string;
}

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('KeyZen must only be used in a server-side Node.js process');
  }
}

export class KeyZen {
  constructor(private readonly options: KeyZenOptions) {
    assertServerOnly();
    if (!options.projectId || !options.environment) {
      throw new Error('KeyZen requires projectId and environment');
    }
  }

  async init(): Promise<void> {
    assertServerOnly();
    throw new Error('KeyZen.init is implemented in Phase 9');
  }

  get(key: string): string | undefined {
    assertServerOnly();
    void key;
    return undefined;
  }

  getAll(): Readonly<Record<string, string>> {
    assertServerOnly();
    return {};
  }

  inject(): void {
    assertServerOnly();
    throw new Error('KeyZen.inject is implemented in Phase 9');
  }

  async sync(): Promise<void> {
    assertServerOnly();
    throw new Error('KeyZen.sync is implemented in Phase 9');
  }

  run(args: string[]): never {
    assertServerOnly();
    void args;
    throw new Error('KeyZen.run is implemented in Phase 9');
  }

  async validate(): Promise<boolean> {
    assertServerOnly();
    void this.options;
    throw new Error('KeyZen.validate is implemented in Phase 9');
  }

  disconnect(): void {
    assertServerOnly();
  }
}
