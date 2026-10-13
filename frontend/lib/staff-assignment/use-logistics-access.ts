"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import { resetPreviewWorkflow } from "@/lib/preview-workflow/assignment-bridge";

type AccessState = "checking" | "allowed" | "forbidden" | "failed";

export function useLogisticsAccess() {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("checking");
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function verify() {
      const query = new URLSearchParams(window.location.search);
      const previewRequested = process.env.NODE_ENV === "development"
        && query.get("preview") === "1";
      if (previewRequested) {
        if (query.get("reset") === "1") {
          resetPreviewWorkflow();
          window.history.replaceState(null, "", `${window.location.pathname}?preview=1`);
        }
        if (active) {
          setPreview(true);
          setState("allowed");
        }
        return;
      }

      if (!getAccessToken()) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!active) return;
        if (currentUser.role !== "LOGISTICS_MANAGER") {
          setMessage("You don't have permission to use the Logistics Manager assignment workspace.");
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

  return { state, preview, message };
}
