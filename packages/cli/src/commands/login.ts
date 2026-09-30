import chalk from 'chalk';
import { configStore } from '../config-store';

export async function loginCommand(token: string, options: { endpoint?: string }) {
  if (!token) {
    console.error(chalk.red('✖ Error: Token is required. Run `keyzen login <kzn_token>`'));
    process.exit(1);
  }

  configStore.set('token', token.trim());
  if (options.endpoint) {
    configStore.set('endpoint', options.endpoint.trim());
  }

  console.log(chalk.green('✔ Successfully logged in to Keyzen!'));
  console.log(chalk.dim(`Stored token in ~/.config/keyzen (${token.slice(0, 12)}...)`));
}
