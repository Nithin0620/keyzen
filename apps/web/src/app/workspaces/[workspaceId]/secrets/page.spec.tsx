import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceSecretsVaultPage from './page';

const { mockGet, mockUseQuery, params } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUseQuery: vi.fn(),
  params: { workspaceId: 'ws-1' },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, use: () => params };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (args: unknown) => mockUseQuery(args),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: mockGet },
}));

class TestBlob {
  constructor(
    readonly parts: string[],
    readonly options?: BlobPropertyBag
  ) {}
}

const clickedAnchors: HTMLAnchorElement[] = [];
const mockCreateObjectURL = vi.fn((blob: Blob) => {
  capturedBlob = blob;
  return 'blob:test';
});
const mockRevokeObjectURL = vi.fn();
let capturedBlob: Blob | null = null;

describe('WorkspaceSecretsVaultPage export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedBlob = null;
    clickedAnchors.length = 0;
    vi.stubGlobal('Blob', TestBlob);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: mockCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: mockRevokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    });

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      const data =
        queryKey[0] === 'workspace-projects'
          ? [{ id: 'proj-1', name: 'Payments' }]
          : queryKey[0] === 'project-environments'
            ? [{ id: 'env-1', name: 'Production', slug: 'production' }]
            : [];
      return { data, isLoading: false, isError: false, refetch: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('downloads a .env file built from the API entries response', async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValueOnce({
      entries: [
        { name: 'API_KEY', value: 'plaintext' },
        { name: 'DATABASE_URL', value: 'postgres://local' },
      ],
    });

    render(<WorkspaceSecretsVaultPage params={Promise.resolve(params)} />);
    await user.click(await screen.findByRole('button', { name: /export \.env/i }));

    expect(mockGet).toHaveBeenCalledWith('/workspaces/ws-1/projects/proj-1/secrets/export', {
      searchParams: { environmentId: 'env-1' },
    });
    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalledTimes(1));
    const blob = capturedBlob as unknown as TestBlob;
    expect(blob.parts.join('')).toBe('API_KEY=plaintext\nDATABASE_URL=postgres://local');
    expect(clickedAnchors[0]?.download).toBe('.env.production');
  });

  it('shows export errors instead of failing silently', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(new Error('Forbidden'));

    render(<WorkspaceSecretsVaultPage params={Promise.resolve(params)} />);
    await user.click(await screen.findByRole('button', { name: /export \.env/i }));

    expect(await screen.findByText('Forbidden')).toBeInTheDocument();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });
});
