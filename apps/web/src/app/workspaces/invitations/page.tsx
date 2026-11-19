'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function WorkspaceInvitationsPage(): React.ReactNode {
  const { user, reloadWorkspaces } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<'prompt' | 'accepted' | 'declined' | 'error'>('prompt');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // SECURITY INVARIANT: Invitation token arrives in URL fragment (#token=...), NEVER query string!
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const parsedToken = params.get('token');

    if (!parsedToken) {
      setStatus('error');
      setErrorMessage('Missing invitation token in URL fragment. Please check your invitation email.');
    } else {
      setToken(parsedToken);
    }
  }, []);

  const handleAccept = async (): Promise<void> => {
    if (!token) return;
    setProcessing(true);
    setErrorMessage(null);
    try {
      await apiClient.post('/workspaces/invitations/accept', { token });
      window.history.replaceState(null, '', window.location.pathname);
      await reloadWorkspaces();
      setStatus('accepted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept invitation. Link may be invalid or expired.';
      setErrorMessage(msg);
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (): Promise<void> => {
    if (!token) return;
    setProcessing(true);
    setErrorMessage(null);
    try {
      await apiClient.post('/workspaces/invitations/decline', { token });
      window.history.replaceState(null, '', window.location.pathname);
      setStatus('declined');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to decline invitation.';
      setErrorMessage(msg);
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#160c40] via-navy to-[#0b0626]" />

      <Card className="w-full max-w-md border-line/40 shadow-2xl text-center">
        <CardHeader className="space-y-2">
          {status === 'prompt' ? (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-peri/20 text-peri-2 border border-peri/30">
              <Users className="size-6" />
            </div>
          ) : status === 'accepted' ? (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/20 text-[#5ee6a8] border border-success/30">
              <CheckCircle2 className="size-6" />
            </div>
          ) : (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/20 text-destructive border border-destructive/30">
              <XCircle className="size-6" />
            </div>
          )}

          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            {status === 'prompt'
              ? 'Workspace Invitation'
              : status === 'accepted'
              ? 'Invitation Accepted'
              : status === 'declined'
              ? 'Invitation Declined'
              : 'Invalid Invitation'}
          </CardTitle>
          <CardDescription className="text-ink-2">
            {status === 'prompt'
              ? 'You have been invited to collaborate on an Aegis workspace.'
              : status === 'accepted'
              ? 'You now have access to this workspace. Head to your dashboard to view projects.'
              : status === 'declined'
              ? 'You have declined this workspace invitation.'
              : 'Unable to process invitation.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {!user && status === 'prompt' && (
            <p className="text-xs text-ink-3">
              Note: You need to be signed in to accept invitations. If you are not signed in, please{' '}
              <Link href={`/auth/login?redirect=${encodeURIComponent('/workspaces/invitations' + (typeof window !== 'undefined' ? window.location.hash : ''))}`} className="text-peri-2 underline">
                sign in first
              </Link>.
            </p>
          )}
        </CardContent>

        <CardFooter className="justify-center gap-3">
          {status === 'prompt' && token && (
            <>
              <Button
                variant="default"
                disabled={processing}
                onClick={() => void handleAccept()}
              >
                {processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Accept Invitation
              </Button>
              <Button
                variant="ghost"
                disabled={processing}
                onClick={() => void handleDecline()}
              >
                Decline
              </Button>
            </>
          )}
          {(status === 'accepted' || status === 'declined' || status === 'error') && (
            <Link href="/dashboard">
              <Button variant="default">Go to Dashboard</Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
