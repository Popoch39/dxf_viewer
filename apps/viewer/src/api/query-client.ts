import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "./client";

const MAX_RETRIES = 3;

function isClientError(error: Error): boolean {
  return error instanceof ApiRequestError && error.status < 500;
}

/**
 * `onUnauthorized` runs whenever the API answers 401, which means the Session
 * expired or was revoked while the viewer was open.
 */
export function createQueryClient(onUnauthorized: () => void): QueryClient {
  const onError = (error: Error) => {
    if (error instanceof ApiRequestError && error.status === 401) {
      onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // A 4xx will not change on retry; network errors and 5xx may.
        retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_RETRIES,
      },
    },
  });
}
