export class CliError extends Error {
  readonly code: string;

  constructor(message: string, code = 'CLI_ERROR') {
    super(message);
    this.name = 'CliError';
    this.code = code;
  }
}
