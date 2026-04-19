"use client";

import { useState, useEffect } from "react";

const KEY = "clarity_demo_mode";

export function useDemoMode() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(localStorage.getItem(KEY) === "true");
  }, []);

  const toggle = () => {
    setDemo((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  };

  return { demo, toggle };
}
