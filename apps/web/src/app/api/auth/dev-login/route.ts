import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST() {
  const secret = process.env.WORKFLOW_AUTH_SECRET || 'workflow-super-secret-production-auth-key-2026';
  const user = {
    id: 'dev-user',
    email: 'developer@keyzen.dev',
    name: 'Developer',
    image: null,
  };

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: '30d' }
  );

  const response = NextResponse.json({
    token,
    user,
  });

  // Set the auth_token cookie
  response.cookies.set('auth_token', token, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    httpOnly: false, // Accessible to client-side localStorage sync if needed
  });

  return response;
}
