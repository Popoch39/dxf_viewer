import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { queryClient } from "./api/query-client.ts";
import App from "./App.tsx";

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Replaced by a no-op in production builds by the package itself. */}
      <ReactQueryDevtools />
    </QueryClientProvider>
  </StrictMode>,
);
