'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps, ReactNode } from 'react';

type ThemeProviderProps = { children: ReactNode } & Omit<ComponentProps<typeof NextThemesProvider>, 'children'>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps): ReactNode {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
