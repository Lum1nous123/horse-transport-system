import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPreviewWork } from "@/lib/driver-execution/preview-service";
import RouteSchematic from "./RouteSchematic";

describe("Driver ROAD route timeline", () => {
  it("orders the selected leg origin, checkpoints, and destination with persisted progress", () => {
    const execution = createPreviewWork("in-progress")[0];
    execution.permissions.nextCheckpointId = "demo-stop-2";
    render(<RouteSchematic execution={execution} selectedPoint="demo-stop-2" onSelect={vi.fn()} />);

    const timeline = screen.getByRole("region", { name: "ROAD route timeline" });
    const points = within(timeline).getAllByRole("listitem");
    expect(points).toHaveLength(4);
    expect(points[0]).toHaveTextContent("OriginBangkok depotAddress not providedStarted");
    expect(points[1]).toHaveTextContent("Checkpoint 1Pathum Thani rest stopAddress not providedArrived");
    expect(points[2]).toHaveTextContent("Checkpoint 2Bang Pa-in checkpointAddress not providedCurrent stop");
    expect(points[3]).toHaveTextContent("DestinationAyutthaya equine centerAddress not providedUpcoming");
  });

  it("uses only the selected ROAD leg endpoints across ROAD/AIR transitions", () => {
    const execution = createPreviewWork("ready")[0];
    execution.legId = "demo-leg-3";
    execution.currentLegId = "demo-leg-3";
    execution.legs[2].status = "READY";
    execution.checkpoints = [];
    render(<RouteSchematic execution={execution} selectedPoint="origin" onSelect={vi.fn()} />);

    const timeline = screen.getByRole("region", { name: "ROAD route timeline" });
    expect(timeline).toHaveTextContent("Amsterdam airport");
    expect(timeline).toHaveTextContent("Utrecht stables");
    expect(timeline).not.toHaveTextContent("Bangkok depot");
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(2);
  });
});
