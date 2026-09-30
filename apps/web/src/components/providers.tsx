'use client';

import React, { useMemo } from 'react';
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../lib/apollo-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createApolloClient(), []);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
