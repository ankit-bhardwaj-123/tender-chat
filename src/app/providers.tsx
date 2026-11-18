"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (_error, query) => {
        if (query.queryKey[0] !== "session") {
          void client.invalidateQueries({ queryKey: ["session"] });
        }
      },
    }),
    defaultOptions: {
      queries: { staleTime: 10_000, retry: 1 },
      mutations: { retry: false },
    },
  });
  return client;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
