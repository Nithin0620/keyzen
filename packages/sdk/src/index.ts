export interface AegisOptions {
  projectId: string;
  environment: string;
  apiKey?: string;
  endpoint?: string;
}

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Aegis must only be used in a server-side Node.js process');
  }
}

export class Aegis {
  constructor(private readonly options: AegisOptions) {
    assertServerOnly();
    if (!options.projectId || !options.environment) {
      throw new Error('Aegis requires projectId and environment');
    }
  }

  async init(): Promise<void> {
    assertServerOnly();
    throw new Error('Aegis.init is implemented in Phase 9');
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
    throw new Error('Aegis.inject is implemented in Phase 9');
  }

  async sync(): Promise<void> {
    assertServerOnly();
    throw new Error('Aegis.sync is implemented in Phase 9');
  }

  run(args: string[]): never {
    assertServerOnly();
    void args;
    throw new Error('Aegis.run is implemented in Phase 9');
  }

  async validate(): Promise<boolean> {
    assertServerOnly();
    void this.options;
    throw new Error('Aegis.validate is implemented in Phase 9');
  }

  disconnect(): void {
    assertServerOnly();
  }
}
