"use client";

import { useEffect } from "react";
import { HANDOFF_KEY } from "@/app/connector/canva/CanvaChat";

// Home's composer (kit composer.js) fires "composer:send"; carry the message to the Canva chat.
export default function SendToCanva() {
  useEffect(() => {
    const onSend = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail.text;
      try {
        sessionStorage.setItem(HANDOFF_KEY, text);
      } catch {
        // storage unavailable: the chat opens empty
      }
      window.location.href = "/connector/canva";
    };
    document.addEventListener("composer:send", onSend);
    return () => document.removeEventListener("composer:send", onSend);
  }, []);
  return null;
}
