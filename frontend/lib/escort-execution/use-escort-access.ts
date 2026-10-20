"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";

export const DEFAULT_PREVIEW_ESCORT_ID = "escort-mia";
export const DEFAULT_PREVIEW_ESCORT_NAME = "Mia Laurent";

type AccessState = "checking" | "allowed" | "forbidden" | "failed";

export function getPreviewEscortIdentity(search: string) {
  const query = new URLSearchParams(search);
  const escortId = query.get("escortId")?.trim() || DEFAULT_PREVIEW_ESCORT_ID;
  const knownNames: Record<string, string> = {
    "escort-mia": "Mia Laurent",
    "escort-liam": "Liam Foster",
  };
  return { id: escortId, name: knownNames[escortId] ?? "Preview Escort" };
}

export function useEscortAccess() {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("checking");
  const [preview, setPreview] = useState(false);
  const [previewEscortId, setPreviewEscortId] = useState(DEFAULT_PREVIEW_ESCORT_ID);
  const [previewEscortName, setPreviewEscortName] = useState(DEFAULT_PREVIEW_ESCORT_NAME);
  const [message, setMessage] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function verify() {
      const query = new URLSearchParams(window.location.search);
      const previewRequested = process.env.NODE_ENV === "development" && query.get("preview") === "1";
      if (previewRequested) {
        if (!active) return;
        const escort = getPreviewEscortIdentity(window.location.search);
        setPreview(true);
        setPreviewEscortId(escort.id);
        setPreviewEscortName(escort.name);
        if (query.get("scenario") === "forbidden") {
          setMessage("You don't have permission to use this Escort workspace.");
          setState("forbidden");
        } else {
          setState("allowed");
        }
        return;
      }

      if (!getAccessToken()) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!active) return;
        if (user.role !== "ESCORT") {
          setMessage("You don't have permission to use this Escort workspace.");
          setState("forbidden");
          return;
        }
        setState("allowed");
      } catch (error) {
        if (!active) return;
        if (!getAccessToken() || (error instanceof Error && error.message === "SESSION_EXPIRED")) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        setMessage("We couldn't verify your access. Check your connection and try again.");
        setState("failed");
      }
    }

    void verify();
    return () => { active = false; };
  }, [router, verificationAttempt]);

  function retryAccess() {
    setMessage("");
    setState("checking");
    setVerificationAttempt((attempt) => attempt + 1);
  }

  return { state, preview, previewEscortId, previewEscortName, message, retryAccess };
}
