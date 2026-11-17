import { Command } from 'commander';

const commands = ['init', 'pull', 'run', 'validate', 'login', 'logout'] as const;

const program = new Command();
program.name('keyzen').description('KeyZen secrets CLI').version('0.1.0');

for (const name of commands) {
  program.command(name).description('Implemented in Phase 10').action(() => {
    throw new Error(`keyzen ${name} is implemented in Phase 10`);
  });
}

program.parse();
