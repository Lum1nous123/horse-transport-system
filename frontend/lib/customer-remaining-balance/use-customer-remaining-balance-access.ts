"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAccessToken, getCurrentUser } from "@/lib/auth";

type AccessState = "checking" | "allowed" | "forbidden" | "failed";

export function useCustomerRemainingBalanceAccess() {
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
        if (!active) return;
        setPreview(true);
        if (query.get("scenario") === "forbidden") {
          setMessage("This Order does not belong to your Customer account.");
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
        if (user.role !== "CUSTOMER") {
          setMessage("Only the Customer who owns this Order can view its Remaining Balance.");
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
