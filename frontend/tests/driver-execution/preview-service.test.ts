import { describe, expect, it } from "vitest";
import { createPreviewDriverService } from "@/lib/driver-execution/preview-service";
import type { DriverExecution } from "@/lib/driver-execution/types";

const driverId = "demo-driver-alex";
const executionId = "demo-execution-204";
const command = (execution: DriverExecution) => ({ executionId: execution.id, expectedRevision: execution.revision });
const service = (scenario: Parameters<typeof createPreviewDriverService>[0]["scenario"] = "ready") =>
  createPreviewDriverService({ driverId, scenario, latency: 0 });

describe("local ROAD behavioral simulation (not real API integration)", () => {
  it("lists only the selected Driver's work and rejects a foreign direct link", async () => {
    const api = service();
    expect((await api.listAssignedWork()).every((item) => item.driverId === driverId)).toBe(true);
    await expect(api.getExecution("demo-execution-205")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("first Start is read back with Vehicle, leg, and Order in progress", async () => {
    const api = service();
    const before = await api.getExecution(executionId);
    await api.startVehicle(command(before));
    const after = await api.getExecution(executionId);
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.order.status).toBe("IN_PROGRESS");
    expect(after.legs[0].status).toBe("IN_PROGRESS");
    expect(after.startedAt).not.toBeNull();
    expect(before.status).toBe("NOT_STARTED");
  });
  it("a second Driver independently starts their own vehicle after refreshing", async () => {
    const saved = new Map<string, string>();
    const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
    const alex = createPreviewDriverService({ driverId, storage, latency: 0 });
    const jamie = createPreviewDriverService({ driverId: "demo-driver-jamie", storage, latency: 0 });
    await alex.startVehicle(command(await alex.getExecution(executionId)));
    const second = await jamie.getExecution("demo-execution-205");
    expect(second.status).toBe("NOT_STARTED");
    expect(second.legs[0].status).toBe("IN_PROGRESS");
    await jamie.startVehicle(command(second));
    expect((await jamie.getExecution(second.id)).status).toBe("IN_PROGRESS");
    expect((await alex.getExecution(executionId)).status).toBe("IN_PROGRESS");
  });
  it("rejects stale and duplicate Start requests", async () => {
    const api = service();
    const before = await api.getExecution(executionId);
    await api.startVehicle(command(before));
    await expect(api.startVehicle(command(before))).rejects.toMatchObject({ code: "STALE_STATE" });
    await expect(api.startVehicle(command(await api.getExecution(executionId)))).rejects.toMatchObject({ code: "ALREADY_RECORDED" });
  });
  it("rejects non-current leg Start", async () => {
    const api = service();
    await expect(api.startVehicle(command(await api.getExecution("demo-execution-119")))).rejects.toMatchObject({ code: "OUT_OF_SEQUENCE" });
  });
  it("rejects checkpoint skipping, foreign checkpoint IDs, and premature destination", async () => {
    const api = service();
    await api.startVehicle(command(await api.getExecution(executionId)));
    const current = command(await api.getExecution(executionId));
    await expect(api.arriveAtCheckpoint({ ...current, checkpointId: "demo-stop-2" })).rejects.toMatchObject({ code: "OUT_OF_SEQUENCE" });
    await expect(api.arriveAtCheckpoint({ ...current, checkpointId: "another-leg-stop" })).rejects.toMatchObject({ code: "OUT_OF_SEQUENCE" });
    await expect(api.arriveAtDestination(current)).rejects.toMatchObject({ code: "OUT_OF_SEQUENCE" });
  });
  it("records arrival for the correct execution and shared checkpoint without duplicating definitions", async () => {
    const api = service("additional-driver");
    await api.startVehicle(command(await api.getExecution(executionId)));
    const before = await api.getExecution(executionId);
    await api.arriveAtCheckpoint({ ...command(before), checkpointId: "demo-stop-1" });
    const after = await api.getExecution(executionId);
    expect(after.arrivals).toEqual([expect.objectContaining({ executionId, checkpointId: "demo-stop-1" })]);
    expect(after.checkpoints).toEqual(before.checkpoints);
  });
  it("destination does not complete the vehicle, leg, or Order", async () => {
    const api = service("in-progress");
    await api.arriveAtCheckpoint({ ...command(await api.getExecution(executionId)), checkpointId: "demo-stop-2" });
    await api.arriveAtDestination(command(await api.getExecution(executionId)));
    const after = await api.getExecution(executionId);
    expect(after.status).toBe("DESTINATION");
    expect(after.legs[0].status).toBe("IN_PROGRESS");
    expect(after.legs[1].status).toBe("PLANNED");
    expect(after.order.status).toBe("IN_PROGRESS");
    expect(after.completedAt).toBeNull();
  });
  it("supports zero intermediate checkpoints", async () => {
    const api = service("no-checkpoints");
    await api.startVehicle(command(await api.getExecution(executionId)));
    const current = await api.getExecution(executionId);
    expect(current.permissions.canArriveAtDestination).toBe(true);
    await api.arriveAtDestination(command(current));
    expect((await api.getExecution(executionId)).status).toBe("DESTINATION");
  });
});
