export type AegisErrorCode =
  | 'SERVER_ONLY'
  | 'CONFIG'
  | 'INPUT'
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'RESPONSE'
  | 'COMMAND';

export class AegisError extends Error {
  readonly code: AegisErrorCode;

  constructor(message: string, code: AegisErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class AegisServerOnlyError extends AegisError {
  constructor() {
    super('Aegis must only be used in a server-side Node.js process', 'SERVER_ONLY');
  }
}

export class AegisConfigError extends AegisError {
  constructor(message: string) {
    super(message, 'CONFIG');
  }
}

export class AegisInputError extends AegisError {
  constructor(message: string) {
    super(message, 'INPUT');
  }
}

export class AegisAuthenticationError extends AegisError {
  constructor() {
    super('Aegis service token was rejected', 'AUTHENTICATION');
  }
}

export class AegisRateLimitError extends AegisError {
  constructor() {
    super('Aegis API rate limit exceeded', 'RATE_LIMITED');
  }
}

export class AegisNetworkError extends AegisError {
  constructor(message: string) {
    super(message, 'NETWORK');
  }
}

export class AegisResponseError extends AegisError {
  constructor() {
    super('Aegis API returned an invalid response', 'RESPONSE');
  }
}

export class AegisCommandError extends AegisError {
  constructor(message: string) {
    super(message, 'COMMAND');
  }
}
