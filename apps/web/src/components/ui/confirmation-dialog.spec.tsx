import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationDialog } from './confirmation-dialog';

describe('ConfirmationDialog', () => {
  it('confirms only when the confirm action is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmationDialog
        trigger={<button type="button">Open dialog</button>}
        title="Delete secret?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('requires typed confirmation text before confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmationDialog
        trigger={<button type="button">Open dialog</button>}
        title="Delete workspace?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        confirmationText="DELETE"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('DELETE');
  });

  it('reports failures without closing the dialog', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('denied'));
    const onError = vi.fn();

    render(
      <ConfirmationDialog
        trigger={<button type="button">Open dialog</button>}
        title="Delete secret?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onError={onError}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to complete this action.');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
