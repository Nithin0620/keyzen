import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders a native button with variant styles', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-destructive');
  });

  it('renders the provided child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/next">Continue</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/next');
  });
});
