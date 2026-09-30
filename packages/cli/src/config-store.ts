import Conf from 'conf';

export interface KeyzenConfig {
  token?: string;
  endpoint?: string;
  defaultProject?: string;
  defaultEnv?: string;
}

export const configStore = new Conf<KeyzenConfig>({
  projectName: 'keyzen',
  defaults: {
    endpoint: 'http://localhost:4000',
    defaultEnv: 'dev',
  },
});

export function resolveActiveToken(cliToken?: string): string {
  return cliToken || process.env.KEYZEN_TOKEN || configStore.get('token') || '';
}

export function resolveActiveEndpoint(cliEndpoint?: string): string {
  return cliEndpoint || process.env.KEYZEN_ENDPOINT || configStore.get('endpoint') || 'http://localhost:4000';
}
