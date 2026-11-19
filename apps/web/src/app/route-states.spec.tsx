import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './error';
import GlobalError from './global-error';
import Loading from './loading';

describe('route-level states', () => {
  it('renders a generic error state and retries without leaking error details', async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(<ErrorBoundary error={new Error('database password=secret')} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent('The dashboard could not be loaded.');
    expect(screen.queryByText(/password=secret/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders a self-contained global error document', () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error('token=secret')} reset={vi.fn()} />);

    expect(html).toContain('<html');
    expect(html).toContain('<body');
    expect(html).toContain('The application could not be loaded.');
    expect(html).not.toContain('token=secret');
  });

  it('renders an accessible loading shell', () => {
    const { container } = render(<Loading />);

    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5);
  });
});
