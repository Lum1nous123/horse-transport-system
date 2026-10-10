"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import {
  DEFAULT_PREVIEW_SPECIALIST_ID,
  getPreviewSpecialistIdentity,
} from "@/lib/preview-workflow/assignment-bridge";

type AccessState = "checking" | "allowed" | "forbidden" | "failed";

export function useTransportSpecialistAccess() {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("checking");
  const [preview, setPreview] = useState(false);
  const [previewSpecialistId, setPreviewSpecialistId] = useState(DEFAULT_PREVIEW_SPECIALIST_ID);
  const [previewSpecialistName, setPreviewSpecialistName] = useState("Alex Carter");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function verify() {
      const query = new URLSearchParams(window.location.search);
      const previewRequested = process.env.NODE_ENV === "development" && query.get("preview") === "1";
      if (previewRequested) {
        if (!active) return;
        const specialist = getPreviewSpecialistIdentity(window.location.search);
        setPreview(true);
        setPreviewSpecialistId(specialist.id);
        setPreviewSpecialistName(specialist.name);
        if (query.get("scenario") === "forbidden") {
          setMessage("You don't have permission to use this Transport Specialist workspace.");
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
        if (user.role !== "TRANSPORT_SPECIALIST") {
          setMessage("You don't have permission to use this Transport Specialist workspace.");
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
  }, [router]);

  return { state, preview, previewSpecialistId, previewSpecialistName, message };
}

