"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDriverSession } from "./service";
import { ExecutionError, type DriverSession } from "./types";

type SessionState =
  | { status: "checking"; session?: never; message?: never }
  | { status: "allowed"; session: DriverSession; message?: never }
  | { status: "forbidden" | "failed"; message: string; session?: never };

export function useDriverSession() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SessionState>({ status: "checking" });
  useEffect(() => {
    let active = true;
    getDriverSession(window.location.search).then((session) => {
      if (active) setState({ status: "allowed", session });
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        router.replace("/login");
        return;
      }
      setState({
        status: error instanceof ExecutionError && error.code === "FORBIDDEN" ? "forbidden" : "failed",
        message: error instanceof ExecutionError ? error.message : "We couldn't verify your account. Check your connection and try again.",
      });
    });
    return () => { active = false; };
  }, [router, attempt]);
  const retry = useCallback(() => { setState({ status: "checking" }); setAttempt((value) => value + 1); }, []);
  return { ...state, retry };
}
