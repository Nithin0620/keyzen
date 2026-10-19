import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const workflowUrl = process.env.NEXT_PUBLIC_WORKFLOW_API_URL || 'http://localhost:3001';

    // 1. Try Workflow API first (with 1.5s timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const workflowRes = await fetch(`${workflowUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (workflowRes.ok) {
        const data = await workflowRes.json();
        const response = NextResponse.json(data);
        if (data.token) {
          response.cookies.set('auth_token', data.token, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
            httpOnly: false,
          });
        }
        return response;
      }
    } catch {
      // Workflow service is offline, fallback to standalone local account
    }

    // 2. Standalone Keyzen Fallback Registration
    const secret = process.env.WORKFLOW_AUTH_SECRET || 'workflow-super-secret-production-auth-key-2026';
    const user = {
      id: `usr_${crypto.randomUUID().slice(0, 12)}`,
      email,
      name: name || email.split('@')[0],
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

    response.cookies.set('auth_token', token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      httpOnly: false,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
