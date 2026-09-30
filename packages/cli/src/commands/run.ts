import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import { Keyzen } from '@keyzen/node';
import { resolveActiveToken, resolveActiveEndpoint } from '../config-store';

export async function runCommand(commandArgs: string[], options: { token?: string; endpoint?: string }) {
  if (!commandArgs || commandArgs.length === 0) {
    console.error(chalk.red('✖ Error: No command specified. Example: `keyzen run -- npm start`'));
    process.exit(1);
  }

  const token = resolveActiveToken(options.token);
  const endpoint = resolveActiveEndpoint(options.endpoint);

  if (!token) {
    console.error(chalk.red('✖ Error: No active service token found. Run `keyzen login <token>` or set KEYZEN_TOKEN.'));
    process.exit(1);
  }

  const spinner = ora(chalk.cyan('Fetching secrets from Keyzen...')).start();

  try {
    const client = new Keyzen({ token, endpoint });
    const secrets = await client.getAll();

    spinner.succeed(chalk.green(`Injected ${Object.keys(secrets).length} secrets into memory (zero-disk)`));

    // Spawn child process with injected environment
    const [bin, ...args] = commandArgs;
    const childEnv = {
      ...process.env,
      ...secrets,
    };

    const subprocess = execa(bin, args, {
      stdio: 'inherit',
      env: childEnv,
    });

    await subprocess;
  } catch (err: any) {
    spinner.fail(chalk.red(`Failed: ${err.message}`));
    process.exit(err.exitCode || 1);
  }
}
