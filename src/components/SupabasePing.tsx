"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export default function SupabasePing() {
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("probando…");

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (e: unknown) {
      const err = e as Error;
      setStatus("error");
      setMessage(err.message ?? "configuración inválida");
      return;
    }

    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        setStatus("ok");
        setMessage("conectado ✅");
      }
    });
  }, []);

  return (
    <p>
      Supabase:{" "}
      {status === "pending"
        ? "probando…"
        : status === "ok"
        ? message
        : `error ❌: ${message}`}
    </p>
  );
}
