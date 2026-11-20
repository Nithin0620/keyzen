import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DocsPage from './page';
import CliDocsPage from './cli/page';
import SdkDocsPage from './sdk/page';
import SecurityDocsPage from './security/page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/docs',
}));

describe('documentation pages', () => {
  it('renders the end-to-end quickstart and next steps', () => {
    render(<DocsPage />);

    expect(screen.getByRole('heading', { name: /secrets in your app, without secrets on disk/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /go from dashboard to running app/i })).toBeInTheDocument();
    expect(screen.getByText('Create a service token')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open sdk reference/i })).toHaveAttribute('href', '/docs/sdk');
    expect(screen.getByRole('link', { name: /open cli reference/i })).toHaveAttribute('href', '/docs/cli');
  });

  it('documents every SDK method and error code', () => {
    render(<SdkDocsPage />);

    expect(screen.getByRole('heading', { name: /the aegis sdk, method by method/i })).toBeInTheDocument();
    for (const method of [
      'await aegis.init()',
      'await aegis.validate()',
      'await aegis.sync(names?)',
      'aegis.get(name)',
      'aegis.getAll()',
      'await aegis.inject(names?)',
      'await aegis.run(args)',
      'aegis.disconnect()',
    ]) {
      expect(screen.getByText(method)).toBeInTheDocument();
    }
    expect(screen.getByText('apiKey is optional')).toBeInTheDocument();
    expect(screen.getByText(/if you omit/i)).toBeInTheDocument();
    expect(screen.getAllByText('AEGIS_SERVICE_TOKEN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AegisAuthenticationError').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AegisRateLimitError').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AegisServerOnlyError').length).toBeGreaterThan(0);
  });

  it('documents every CLI command and safety rule', () => {
    render(<CliDocsPage />);

    expect(screen.getByRole('heading', { name: /the aegis cli, command by command/i })).toBeInTheDocument();
    for (const command of ['aegis init', 'aegis validate', 'aegis pull', 'aegis run', 'aegis login', 'aegis logout']) {
      expect(screen.getAllByText(command).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/the config file never stores the token/i)).toBeInTheDocument();
    expect(screen.getByText(/treat pull output as sensitive/i)).toBeInTheDocument();
  });

  it('explains token scope, audit behavior, and runtime endpoints', () => {
    render(<SecurityDocsPage />);

    expect(screen.getByRole('heading', { name: /safe by default, explicit by design/i })).toBeInTheDocument();
    expect(screen.getByText(/hash only/i)).toBeInTheDocument();
    expect(screen.getByText('GET /v1/validate')).toBeInTheDocument();
    expect(screen.getByText('POST /v1/secrets/resolve')).toBeInTheDocument();
  });

  it('does not include placeholder credentials in the docs', () => {
    const { container } = render(<DocsPage />);
    expect(container.textContent).not.toMatch(/ags_[A-Za-z0-9]/);
    expect(container.textContent).not.toMatch(/your[_-]?token/i);
  });
});
