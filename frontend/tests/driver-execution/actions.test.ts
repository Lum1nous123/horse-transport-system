import { describe, expect, it } from "vitest";
import { checkpointArrival, nextDriverAction } from "@/lib/driver-execution/actions";
import { createPreviewWork } from "@/lib/driver-execution/preview-service";

const driverId = "demo-driver-alex";

describe("Driver action visibility", () => {
  it("allows first Driver Start on a READY leg", () => {
    expect(nextDriverAction(createPreviewWork()[0], driverId)?.type).toBe("START");
  });
  it("allows an additional Driver to Start on the current IN_PROGRESS leg", () => {
    expect(nextDriverAction(createPreviewWork("additional-driver")[0], driverId)?.type).toBe("START");
  });
  it("never exposes an action for another Driver", () => {
    expect(nextDriverAction(createPreviewWork()[0], "someone-else")).toBeNull();
  });
  it("never exposes a Start for a non-current leg", () => {
    expect(nextDriverAction(createPreviewWork()[1], driverId)).toBeNull();
  });
  it.each(["CANCELLED", "REJECTED", "DELIVERED"] as const)("blocks a terminal %s order", (status) => {
    const execution = createPreviewWork()[0];
    execution.order.status = status;
    expect(nextDriverAction(execution, driverId)).toBeNull();
  });
  it("requires server eligibility even for a current READY leg", () => {
    const execution = createPreviewWork()[0];
    execution.permissions.canStart = false;
    expect(nextDriverAction(execution, driverId)).toBeNull();
  });
  it("rejects a checkpoint permission that skips the next unreached checkpoint", () => {
    const execution = createPreviewWork("in-progress")[0];
    execution.arrivals = [];
    execution.permissions.nextCheckpointId = "demo-stop-2";
    expect(nextDriverAction(execution, driverId)).toBeNull();
  });
  it("does not use another vehicle's arrivals as this vehicle's progression", () => {
    const execution = createPreviewWork("in-progress")[0];
    execution.arrivals[0].executionId = "demo-execution-205";
    expect(checkpointArrival(execution, "demo-stop-1")).toBeUndefined();
  });
  it.each(["destination", "completed"] as const)("has no Driver action after %s", (scenario) => {
    expect(nextDriverAction(createPreviewWork(scenario)[0], driverId)).toBeNull();
  });
  it("does not offer a ROAD action for an AIR leg", () => {
    const execution = createPreviewWork()[0];
    execution.legs[0].type = "AIR";
    expect(nextDriverAction(execution, driverId)).toBeNull();
  });
});
