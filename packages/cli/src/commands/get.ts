import chalk from 'chalk';
import { Keyzen } from '@keyzen/node';
import { resolveActiveToken, resolveActiveEndpoint } from '../config-store';

export async function getCommand(secretName: string, options: { token?: string; endpoint?: string }) {
  if (!secretName) {
    console.error(chalk.red('✖ Error: Secret name required. Usage: `keyzen get <NAME>`'));
    process.exit(1);
  }

  const token = resolveActiveToken(options.token);
  const endpoint = resolveActiveEndpoint(options.endpoint);

  if (!token) {
    console.error(chalk.red('✖ Error: No active service token found. Run `keyzen login <token>` or set KEYZEN_TOKEN.'));
    process.exit(1);
  }

  try {
    const client = new Keyzen({ token, endpoint });
    const value = await client.get(secretName);

    if (value === undefined) {
      console.error(chalk.yellow(`⚠ Secret "${secretName}" not found in current environment.`));
      process.exit(1);
    }

    // Print raw value so it can be piped (e.g. `keyzen get API_KEY | pbcopy`)
    process.stdout.write(value);
  } catch (err: any) {
    console.error(chalk.red(`✖ ${err.message}`));
    process.exit(1);
  }
}
