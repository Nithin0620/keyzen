import { validateEnv } from '../config/env';

export type MailKind = 'verify' | 'reset' | 'invite';

export class MailService {
  private readonly devOutbox = new Map<string, string>();

  async send(kind: MailKind, email: string, token: string, workspaceName?: string): Promise<void> {
    const env = validateEnv();
    if (!env.RESEND_API_KEY) {
      if (env.NODE_ENV !== 'production') {
        this.devOutbox.set(`${kind}:${email}`, token);
      }
      return;
    }

    const subjects: Record<MailKind, string> = {
      verify: 'Verify your Aegis email',
      reset: 'Reset your Aegis password',
      invite: `You are invited to ${workspaceName ?? 'an Aegis workspace'}`,
    };
    const paths: Record<MailKind, string> = {
      verify: '/auth/verify',
      reset: '/auth/reset',
      invite: '/workspaces/invitations',
    };
    const labels: Record<MailKind, string> = {
      verify: 'Verify email',
      reset: 'Reset password',
      invite: 'Accept invitation',
    };
    const link = `${env.WEB_ORIGIN}${paths[kind]}#token=${encodeURIComponent(token)}`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email],
        subject: subjects[kind],
        html: `<p>Open this link to continue: <a href="${link}">${labels[kind]}</a></p>`,
      }),
    });
    if (!response.ok) {
      throw new Error('Email delivery failed');
    }
  }

  takeDevToken(email: string, kind: MailKind): string | undefined {
    if (validateEnv().NODE_ENV === 'production') {
      return undefined;
    }
    const key = `${kind}:${email}`;
    const token = this.devOutbox.get(key);
    if (!token) {
      return undefined;
    }
    this.devOutbox.delete(key);
    return token;
  }
}
