export const PUBLIC_ROUTES = new Set([
  'GET /health',
  'POST /auth/signup',
  'POST /auth/verify',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/password-reset/request',
  'POST /auth/password-reset/confirm',
  'GET /auth/google',
  'GET /auth/google/callback',
  'POST /billing/webhook',
]);
