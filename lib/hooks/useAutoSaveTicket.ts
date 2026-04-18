"use client";

import { useEffect, useRef, useState } from "react";

export function useAutoSaveTicket<T>(
  ticketId: string | null,
  value: T,
  serialize: (v: T) => unknown,
  debounceMs = 1500,
  intervalMs = 30_000,
) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSerialized = useRef<string>("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const save = async () => {
    if (!ticketId) return;
    const payload = serialize(value);
    const payloadStr = JSON.stringify(payload);
    if (payloadStr === lastSerialized.current) return;
    setStatus("saving");
    try {
      const r = await fetch(`/api/workspace/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
      });
      if (!r.ok) throw new Error();
      lastSerialized.current = payloadStr;
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!ticketId) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(save, debounceMs);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, JSON.stringify(value)]);

  useEffect(() => {
    if (!ticketId) return;
    intervalTimer.current = setInterval(save, intervalMs);
    return () => {
      if (intervalTimer.current) clearInterval(intervalTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  return { status, lastSavedAt, saveNow: save };
}
