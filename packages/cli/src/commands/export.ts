import chalk from 'chalk';
import { Keyzen } from '@keyzen/node';
import { resolveActiveToken, resolveActiveEndpoint } from '../config-store';

export async function exportCommand(options: { token?: string; endpoint?: string; format?: string }) {
  const token = resolveActiveToken(options.token);
  const endpoint = resolveActiveEndpoint(options.endpoint);
  const format = options.format || 'env';

  if (!token) {
    console.error(chalk.red('✖ Error: No active service token found. Run `keyzen login <token>` or set KEYZEN_TOKEN.'));
    process.exit(1);
  }

  try {
    const client = new Keyzen({ token, endpoint });
    const secrets = await client.getAll();

    if (format === 'json') {
      console.log(JSON.stringify(secrets, null, 2));
    } else {
      for (const [k, v] of Object.entries(secrets)) {
        // Escape quotes if needed
        const escaped = v.includes('\n') || v.includes(' ') ? `"${v.replace(/"/g, '\\"')}"` : v;
        console.log(`${k}=${escaped}`);
      }
    }
  } catch (err: any) {
    console.error(chalk.red(`✖ ${err.message}`));
    process.exit(1);
  }
}
