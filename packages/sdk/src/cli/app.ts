import { Command, CommanderError } from 'commander';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';
import { Aegis, type AegisOptions } from '../index';
import type { CliConfigStore } from './config';
import { FileCliConfigStore } from './config';
import { createCredentialStore, type CredentialStore } from './credentials';
import { CliError } from './errors';

export interface AegisLike {
  sync(names?: string[]): Promise<void>;
  getAll(): Readonly<Record<string, string>>;
  validate(): Promise<boolean>;
  run(args: string[]): Promise<number>;
  disconnect(): void;
}

export interface CliDependencies {
  configStore: CliConfigStore;
  credentialStore: CredentialStore;
  clientFactory: (options: AegisOptions) => AegisLike;
  stdout(message: string): void;
  stderr(message: string): void;
  promptToken(): Promise<string>;
}

export type CliOverrides = Partial<CliDependencies>;

interface CommonOptions {
  project?: string;
  environment?: string;
  endpoint?: string;
  timeout?: string;
}

interface PullOptions extends CommonOptions {
  format?: string;
  name?: string[];
}

interface State {
  exitCode: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function emit(sink: (message: string) => void, payload: unknown): void {
  sink(`${JSON.stringify(payload)}\n`);
}

async function defaultPromptToken(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
  });
  try {
    return (await rl.question('Aegis service token: ')).trim();
  } finally {
    rl.close();
  }
}

export async function createDependencies(overrides: CliOverrides = {}): Promise<CliDependencies> {
  return {
    configStore: overrides.configStore ?? new FileCliConfigStore(),
    credentialStore: overrides.credentialStore ?? (await createCredentialStore()),
    clientFactory: overrides.clientFactory ?? ((options) => new Aegis(options)),
    stdout: overrides.stdout ?? ((message) => process.stdout.write(message)),
    stderr: overrides.stderr ?? ((message) => process.stderr.write(message)),
    promptToken: overrides.promptToken ?? defaultPromptToken,
  };
}

function withCommonOptions(command: Command): Command {
  return command
    .option('--project <projectId>', 'Aegis project ID')
    .option('--environment <environment>', 'Aegis environment')
    .option('--endpoint <url>', 'Aegis API endpoint')
    .option('--timeout <ms>', 'Request timeout in milliseconds');
}

async function resolveClient(
  options: CommonOptions,
  deps: CliDependencies
): Promise<{ client: AegisLike; projectId: string; environment: string; endpoint?: string }> {
  const config = deps.configStore.load();
  const projectId = options.project ?? process.env.AEGIS_PROJECT_ID ?? config.projectId;
  const environment = options.environment ?? process.env.AEGIS_ENVIRONMENT ?? config.environment;
  const endpoint = options.endpoint ?? process.env.AEGIS_API_URL ?? config.endpoint;
  const token = process.env.AEGIS_SERVICE_TOKEN ?? (await deps.credentialStore.get());

  if (!projectId || !environment) {
    throw new CliError('Missing project or environment; run aegis init or pass --project and --environment', 'CONFIG');
  }
  if (!token) {
    throw new CliError('No service token found; run aegis login or set AEGIS_SERVICE_TOKEN', 'CONFIG');
  }

  const timeoutMs = options.timeout === undefined ? DEFAULT_TIMEOUT_MS : Number(options.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new CliError('Timeout must be a positive integer', 'CONFIG');
  }

  const client = deps.clientFactory({
    projectId,
    environment,
    apiKey: token,
    ...(endpoint ? { endpoint } : {}),
    timeoutMs,
  });

  return { client, projectId, environment, endpoint };
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof CliError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return { code: error.code, message: error.message };
  }
  return { code: 'CLI_ERROR', message: 'Aegis CLI failed' };
}

export function createProgram(deps: CliDependencies, state: State = { exitCode: 0 }): Command {
  const program = new Command();
  program
    .name('aegis')
    .description('Aegis secrets CLI')
    .version('0.1.0')
    .enablePositionalOptions()
    .exitOverride()
    .configureOutput({
      writeOut: (message) => deps.stdout(message),
      writeErr: (message) => deps.stderr(message),
    });

  withCommonOptions(
    program.command('init').description('Validate credentials and store non-secret CLI config')
  ).action(async (options: CommonOptions) => {
    const { client, projectId, environment, endpoint } = await resolveClient(options, deps);
    try {
      await client.validate();
      deps.configStore.save({
        projectId,
        environment,
        ...(endpoint ? { endpoint } : {}),
      });
      emit(deps.stdout, {
        status: 'ok',
        projectId,
        environment,
        ...(endpoint ? { endpoint } : {}),
      });
    } finally {
      client.disconnect();
    }
  });

  withCommonOptions(program.command('validate').description('Validate the active service token'))
    .action(async (options: CommonOptions) => {
      const { client, projectId, environment } = await resolveClient(options, deps);
      try {
        await client.validate();
        emit(deps.stdout, { valid: true, projectId, environment });
      } finally {
        client.disconnect();
      }
    });

  withCommonOptions(program.command('pull').description('Fetch secrets without writing them to disk'))
    .option('--name <name>', 'Secret name to include', (value, previous: string[]) => [...previous, value], [] as string[])
    .option('--format <format>', 'Output format: json or env', 'json')
    .action(async (options: PullOptions) => {
      const { client } = await resolveClient(options, deps);
      try {
        await client.sync(options.name);
        const entries = Object.entries(client.getAll());
        if (options.format === 'env') {
          for (const [name, value] of entries) {
            deps.stdout(`${name}=${value}\n`);
          }
        } else {
          emit(deps.stdout, { entries: entries.map(([name, value]) => ({ name, value })) });
        }
      } finally {
        client.disconnect();
      }
    });

  withCommonOptions(
    program
      .command('run')
      .description('Run a child process with secrets injected in memory')
      .passThroughOptions()
      .allowUnknownOption()
      .argument('[args...]', 'Command and arguments')
  ).action(async (args: string[], options: CommonOptions) => {
    if (args.length === 0) {
      throw new CliError('aegis run requires a command', 'CONFIG');
    }
    const { client } = await resolveClient(options, deps);
    try {
      state.exitCode = await client.run(args);
    } finally {
      client.disconnect();
    }
  });

  program
    .command('login')
    .description('Store a service token in the OS keychain')
    .action(async () => {
      const token = process.env.AEGIS_SERVICE_TOKEN ?? (await deps.promptToken());
      if (!token) {
        throw new CliError('A service token is required', 'CONFIG');
      }
      await deps.credentialStore.set(token);
      emit(deps.stdout, { status: 'ok', stored: true, store: deps.credentialStore.kind });
    });

  program
    .command('logout')
    .description('Remove the stored service token')
    .action(async () => {
      await deps.credentialStore.delete();
      emit(deps.stdout, { status: 'ok', stored: false });
    });

  return program;
}

export async function runCli(argv: string[], overrides: CliOverrides = {}): Promise<number> {
  const deps = await createDependencies(overrides);
  const state: State = { exitCode: 0 };
  const program = createProgram(deps, state);

  try {
    await program.parseAsync(argv, { from: 'user' });
    return state.exitCode;
  } catch (error) {
    if (error instanceof CommanderError && (error.code === 'commander.version' || error.code.startsWith('commander.help'))) {
      return state.exitCode;
    }
    const details = errorDetails(error);
    emit(deps.stderr, { error: details });
    return 1;
  }
}
