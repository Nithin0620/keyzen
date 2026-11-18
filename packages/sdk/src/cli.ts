import process from 'node:process';
import { runCli } from './cli/app';

process.exitCode = await runCli(process.argv.slice(2));
