import { validateEnv } from '../config/env';

export type MailKind = 'verify' | 'reset' | 'invite' | 'security';

const SUBJECTS: Record<MailKind, string> = {
  verify: 'Verify your Aegis email',
  reset: 'Reset your Aegis password',
  invite: 'You are invited to an Aegis workspace',
  security: 'Aegis security alert',
};

const PATHS: Record<MailKind, string> = {
  verify: '/auth/verify',
  reset: '/auth/reset',
  invite: '/workspaces/invitations',
  security: '',
};

const LABELS: Record<MailKind, string> = {
  verify: 'Verify email',
  reset: 'Reset password',
  invite: 'Accept invitation',
  security: 'Review alert',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, content: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#111827"><main style="max-width:560px;margin:auto;padding:24px"><h1>${escapeHtml(title)}</h1>${content}<p style="color:#6b7280;font-size:12px">If you did not expect this message, ignore it and contact your workspace administrator.</p></main></body></html>`;
}

function actionLink(link: string, label: string): string {
  return `<p><a href="${escapeHtml(link)}" style="background:#111827;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

export class MailService {
  private readonly devOutbox = new Map<string, string>();

  async send(kind: MailKind, email: string, token: string, workspaceName?: string): Promise<void> {
    const env = validateEnv();
    if (!env.RESEND_API_KEY) {
      if (env.NODE_ENV !== 'production' && kind !== 'security') {
        this.devOutbox.set(`${kind}:${email}`, token);
      }
      return;
    }

    const subject =
      kind === 'invite' && workspaceName
        ? `You are invited to ${workspaceName}`
        : SUBJECTS[kind];
    const link = kind === 'security'
      ? ''
      : `${env.WEB_ORIGIN}${PATHS[kind]}#token=${encodeURIComponent(token)}`;
    const content = kind === 'security'
      ? `<p>${escapeHtml(token)}</p>`
      : `<p>${escapeHtml(kind === 'invite' ? `You have been invited to ${workspaceName ?? 'an Aegis workspace'}.` : `Use the link below to ${LABELS[kind].toLowerCase()}.`)}</p>${actionLink(link, LABELS[kind])}`;

    await this.deliver(email, subject, layout(subject, content));
  }

  async sendAlert(subject: string, message: string): Promise<void> {
    const env = validateEnv();
    if (!env.OPS_ALERT_EMAIL) {
      return;
    }
    await this.deliver(env.OPS_ALERT_EMAIL, `Aegis alert: ${subject}`, layout(subject, `<p>${escapeHtml(message)}</p>`));
  }

  takeDevToken(email: string, kind: Exclude<MailKind, 'security'>): string | undefined {
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

  private async deliver(email: string, subject: string, html: string): Promise<void> {
    const env = validateEnv();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      throw new Error('Email delivery failed');
    }
  }
}
