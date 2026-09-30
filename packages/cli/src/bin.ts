import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { runCommand } from './commands/run';
import { getCommand } from './commands/get';
import { exportCommand } from './commands/export';

const program = new Command();

program
  .name('keyzen')
  .description('Keyzen Secrets Management CLI - Secure, zero-disk environment secret injection')
  .version('0.1.0');

program
  .command('login <token>')
  .description('Authenticate CLI with a Keyzen service token')
  .option('-e, --endpoint <url>', 'Keyzen API endpoint URL')
  .action((token, options) => loginCommand(token, options));

program
  .command('run')
  .description('Execute a command with Keyzen secrets injected into process.env')
  .option('-t, --token <token>', 'Keyzen service token')
  .option('-e, --endpoint <url>', 'Keyzen API endpoint')
  .allowUnknownOption()
  .argument('[command...]', 'Command and arguments to execute (after --)')
  .action((commandArgs, options) => runCommand(commandArgs, options));

program
  .command('get <name>')
  .description('Fetch a single secret value by name')
  .option('-t, --token <token>', 'Keyzen service token')
  .option('-e, --endpoint <url>', 'Keyzen API endpoint')
  .action((name, options) => getCommand(name, options));

program
  .command('export')
  .description('Export secrets to standard output (.env format or JSON)')
  .option('-t, --token <token>', 'Keyzen service token')
  .option('-e, --endpoint <url>', 'Keyzen API endpoint')
  .option('-f, --format <format>', 'Export format (env or json)', 'env')
  .action((options) => exportCommand(options));

program.parse(process.argv);
