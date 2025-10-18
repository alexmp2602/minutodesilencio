// src/app/providers.tsx
"use client";

import * as React from "react";
import { SWRConfig } from "swr";
import { MuteProvider } from "@/hooks/useMute";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <React.StrictMode>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateIfStale: true,
          revalidateOnReconnect: true,
          errorRetryCount: 2,
          errorRetryInterval: 2500,
          shouldRetryOnError: true,
        }}
      >
        <MuteProvider>{children}</MuteProvider>
      </SWRConfig>
    </React.StrictMode>
  );
}
