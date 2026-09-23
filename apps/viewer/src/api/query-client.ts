import { QueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "./client";

const MAX_RETRIES = 3;

function isClientError(error: Error): boolean {
  return error instanceof ApiRequestError && error.status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx will not change on retry; network errors and 5xx may.
      retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_RETRIES,
    },
  },
});
