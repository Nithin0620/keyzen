export { routeKey } from './route-manifest';

export function normalizeRoutePath(base: string, suffix: string): string {
  const joined = `${base}/${suffix}`.replace(/\/+/g, '/');
  return joined === '/' ? '/' : joined.replace(/\/$/, '');
}
