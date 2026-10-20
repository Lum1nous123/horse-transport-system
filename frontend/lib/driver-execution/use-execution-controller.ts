"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentExecutionLeg, nextDriverAction, type DriverAction } from "./actions";
import { ExecutionError, type DriverExecution, type DriverExecutionService } from "./types";

export function useExecutionController(service: DriverExecutionService, executionId: string, driverId: string) {
  const [execution, setExecution] = useState<DriverExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  const inFlightAction = useRef(false);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const saved = await service.getExecution(executionId);
      if (!mounted.current || request !== generation.current) return null;
      if (saved.id !== executionId || saved.driverId !== driverId) {
        throw new ExecutionError("This vehicle is not assigned to you. Return to My ROAD work.", "FORBIDDEN");
      }
      setExecution(saved);
      setNeedsRefresh(false);
      return saved;
    } catch (caught) {
      if (!mounted.current || request !== generation.current) return null;
      setNeedsRefresh(true);
      setError(caught instanceof Error ? caught.message : "Could not refresh this journey. Try again.");
      if (caught instanceof ExecutionError && ["FORBIDDEN", "NOT_FOUND"].includes(caught.code)) setExecution(null);
      return null;
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, [service, executionId, driverId]);

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    return () => { active = false; mounted.current = false; };
  }, [refresh]);

  const perform = useCallback(async (requested: DriverAction) => {
    if (inFlightAction.current || !execution || needsRefresh || loading) return null;
    const allowed = nextDriverAction(execution, driverId);
    if (!allowed || allowed.type !== requested.type
      || (allowed.type === "CHECKPOINT" && requested.type === "CHECKPOINT" && allowed.checkpointId !== requested.checkpointId)) return null;
    inFlightAction.current = true;
    // Invalidate any earlier reads before changing server state.
    generation.current++;
    setBusy(true);
    setError("");
    setNotice("");
    let acknowledged = false;
    try {
      const command = { executionId, expectedRevision: execution.revision };
      if (allowed.type === "START") await service.startVehicle(command);
      else if (allowed.type === "CHECKPOINT") await service.arriveAtCheckpoint({ ...command, checkpointId: allowed.checkpointId });
      else await service.arriveAtDestination(command);
      acknowledged = true;
      if (!mounted.current) return null;
      // No optimistic status, time, checkpoint tick, route change, or success
      // message. Always read persisted state after the command.
      const saved = await refresh();
      if (!mounted.current) return null;
      const confirmed = saved && (allowed.type === "START"
        ? saved.status !== "NOT_STARTED"
          && ["IN_PROGRESS", "DELIVERED"].includes(saved.order.status)
          && ["IN_PROGRESS", "COMPLETED"].includes(currentExecutionLeg(saved)?.status ?? "")
        : allowed.type === "CHECKPOINT"
          ? saved.arrivals.some((arrival) => arrival.executionId === executionId && arrival.checkpointId === allowed.checkpointId)
          : Boolean(saved.destinationArrivedAt) && ["DESTINATION", "COMPLETED"].includes(saved.status));
      if (!confirmed) {
        setNeedsRefresh(true);
        setError("The request was received, but its saved result could not be confirmed. Refresh before taking another action.");
        return null;
      }
      setNotice(allowed.type === "START" ? "Your vehicle has started." : "Your arrival is recorded.");
      return saved;
    } catch (caught) {
      if (!mounted.current) return null;
      // A timeout may hide a committed mutation. Reconcile even failed commands
      // and never automatically retry a write.
      const saved = await refresh();
      if (!mounted.current) return null;
      setError(caught instanceof Error ? caught.message : "The action could not be confirmed. Refresh before trying again.");
      setNeedsRefresh(!saved || acknowledged);
      return null;
    } finally {
      inFlightAction.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [execution, driverId, executionId, service, needsRefresh, loading, refresh]);

  return { execution, loading, busy, error, notice, needsRefresh, refresh, perform };
}
