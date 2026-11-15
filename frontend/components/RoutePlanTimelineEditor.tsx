"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RoadLegSetup from "@/components/RoadLegSetup";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
  type RoadCheckpoint,
  type RoadCheckpointInput,
  type RoadCheckpointType,
  type RouteLegInput,
  type RouteLegType,
  type RoutePlanDetail,
  type RoutePlanLeg,
} from "@/lib/fleet-route-coordinator/service";

type Props = {
  orderId: string;
  orderCode: string;
  orderOrigin: string;
  orderDestination: string;
  requestedDeliveryDate: string | null;
  returnedReason: string | null;
  horseCount: number;
  transportMode: string;
  queueHref: string;
  service: FleetRouteCoordinatorService;
};

type LegDraft = {
  legType: RouteLegType;
  origin: string;
  destination: string;
  plannedDepartureAt: string;
  plannedArrivalAt: string;
  airProviderName: string;
  airReference: string;
  airCapacityHorses: string;
  equipmentDetails: string;
  notes: string;
};

type CheckpointDraft = {
  name: string;
  checkpointType: RoadCheckpointType;
  countryCode: string;
  minimumRequiredStopMinutes: string;
  plannedStopDurationMinutes: string;
  notes: string;
};

const emptyLegDraft: LegDraft = {
  legType: "ROAD", origin: "", destination: "", plannedDepartureAt: "", plannedArrivalAt: "",
  airProviderName: "", airReference: "", airCapacityHorses: "", equipmentDetails: "", notes: "",
};
const emptyStopDraft: CheckpointDraft = {
  name: "", checkpointType: "REST_STOP", countryCode: "", minimumRequiredStopMinutes: "", plannedStopDurationMinutes: "", notes: "",
};

function localDateTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function shiftLocalDateTime(value: string, minutes: number) {
  const date = new Date(`${value.slice(0, 16)}:00Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().slice(0, 16);
}

function showDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function showTime(value: string) {
  const date = new Date(`${localDateTime(value)}:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date);
}

function draftFor(leg: RoutePlanLeg): LegDraft {
  return {
    legType: leg.legType, origin: leg.origin, destination: leg.destination,
    plannedDepartureAt: localDateTime(leg.plannedDepartureAt), plannedArrivalAt: localDateTime(leg.plannedArrivalAt),
    airProviderName: leg.airProviderName ?? "", airReference: leg.airReference ?? "",
    airCapacityHorses: leg.airCapacityHorses?.toString() ?? "", equipmentDetails: leg.equipmentDetails ?? "", notes: leg.notes ?? "",
  };
}

function inputFor(leg: RoutePlanLeg): RouteLegInput {
  return {
    legType: leg.legType, origin: leg.origin, destination: leg.destination,
    plannedDepartureAt: leg.plannedDepartureAt, plannedArrivalAt: leg.plannedArrivalAt,
    airProviderName: leg.airProviderName, airReference: leg.airReference,
    airCapacityHorses: leg.airCapacityHorses, equipmentDetails: leg.equipmentDetails, notes: leg.notes,
  };
}

function inputForDraft(draft: LegDraft): RouteLegInput {
  return {
    legType: draft.legType, origin: draft.origin.trim(), destination: draft.destination.trim(),
    plannedDepartureAt: `${draft.plannedDepartureAt}:00`, plannedArrivalAt: `${draft.plannedArrivalAt}:00`,
    airProviderName: draft.legType === "AIR" ? draft.airProviderName.trim() || null : null,
    airReference: draft.legType === "AIR" ? draft.airReference.trim() || null : null,
    airCapacityHorses: draft.legType === "AIR" && draft.airCapacityHorses ? Number(draft.airCapacityHorses) : null,
    equipmentDetails: draft.equipmentDetails.trim() || null, notes: draft.notes.trim() || null,
  };
}

function statusLabel(status: RoutePlanDetail["status"]) {
  if (status === "NOT_STARTED") return "Draft";
  if (status === "PENDING_LM_REVIEW") return "Awaiting LM review";
  if (status === "RETURNED") return "Returned by LM";
  return status[0] + status.slice(1).toLowerCase();
}

function samePlace(left: string, right: string) { return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase(); }

function checkpointLabel(type: RoadCheckpointType) {
  if (type === "REST_STOP") return "Rest & welfare";
  if (type === "BORDER") return "Border";
  if (type === "QUARANTINE") return "Quarantine";
  return "Other · health check";
}

function CheckpointStops({ orderId, leg, service, readOnly }: { orderId: string; leg: RoutePlanLeg; service: FleetRouteCoordinatorService; readOnly: boolean }) {
  const [stops, setStops] = useState<RoadCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CheckpointDraft>(emptyStopDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void service.getRoadLegSetup(orderId, leg.id).then((setup) => { if (active) setStops(setup.checkpoints); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Stops could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leg.id, orderId, service]);
  function edit(stop?: RoadCheckpoint) {
    setEditingId(stop?.id ?? "new");
    setDraft(stop ? { name: stop.name, checkpointType: stop.checkpointType, countryCode: stop.countryCode ?? "", minimumRequiredStopMinutes: stop.minimumRequiredStopMinutes?.toString() ?? "", plannedStopDurationMinutes: stop.plannedStopDurationMinutes?.toString() ?? "", notes: stop.notes ?? "" } : emptyStopDraft);
    setError("");
  }
  function stopInput(): RoadCheckpointInput {
    const rest = draft.checkpointType === "REST_STOP";
    return {
      name: draft.name.trim(), checkpointType: draft.checkpointType, countryCode: draft.countryCode.trim().toUpperCase() || null,
      minimumRequiredStopMinutes: rest && draft.minimumRequiredStopMinutes ? Number(draft.minimumRequiredStopMinutes) : null,
      plannedStopDurationMinutes: rest && draft.plannedStopDurationMinutes ? Number(draft.plannedStopDurationMinutes) : null,
      notes: draft.notes.trim() || null,
    };
  }
  async function saveStop(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const saved = await service.saveRoadCheckpoint(orderId, leg.id, stopInput(), editingId !== "new" ? editingId ?? undefined : undefined);
      setStops(saved.checkpoints); setEditingId(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Stop could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(stop: RoadCheckpoint) {
    if (!window.confirm(`Remove stop “${stop.name}”?`)) return;
    setBusy(true); setError("");
    try { const saved = await service.deleteRoadCheckpoint(orderId, leg.id, stop.id); setStops(saved.checkpoints); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Stop could not be removed."); }
    finally { setBusy(false); }
  }
  return <div className="rc-stops"><div className="rc-stops-head"><div><strong>Welfare &amp; health stops</strong><small>Optional checks along this ROAD leg</small></div>{!readOnly && <button className="rc-add-stop-button" type="button" onClick={() => edit()}><span aria-hidden="true">＋</span> Add stop</button>}</div>
    {loading ? <p className="rc-muted">Loading stops…</p> : stops.length === 0 ? <p className="rc-muted">No planned stops on this leg.</p> : <div className="rc-stop-list">{stops.map((stop) => <div className="rc-stop" key={stop.id}><span className="rc-stop-icon">{stop.checkpointType === "REST_STOP" ? "♡" : "⌖"}</span><div><strong>{stop.name}</strong><small>{checkpointLabel(stop.checkpointType)}{stop.plannedStopDurationMinutes !== null ? ` · ${stop.plannedStopDurationMinutes} min` : ""}{stop.countryCode ? ` · ${stop.countryCode}` : ""}</small>{stop.notes && <p>{stop.notes}</p>}</div>{!readOnly && <div className="rc-stop-actions"><button type="button" onClick={() => edit(stop)}>Edit</button><button type="button" aria-label={`Remove ${stop.name}`} onClick={() => void remove(stop)}>×</button></div>}</div>)}</div>}
    {error && <p className="rc-error" role="alert">{error}</p>}
    {editingId && <form className="rc-stop-editor" onSubmit={(event) => void saveStop(event)}><div className="rc-editor-grid"><label>Stop name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Rest area or inspection point" /></label><label>Stop type<select value={draft.checkpointType} onChange={(event) => setDraft({ ...draft, checkpointType: event.target.value as RoadCheckpointType })}><option value="REST_STOP">Rest &amp; welfare</option><option value="BORDER">Border</option><option value="QUARANTINE">Quarantine</option><option value="OTHER">Other · health check</option></select></label>{draft.checkpointType === "REST_STOP" && <><label>Minimum rest (minutes)<input required min="0" type="number" value={draft.minimumRequiredStopMinutes} onChange={(event) => setDraft({ ...draft, minimumRequiredStopMinutes: event.target.value })} /></label><label>Planned rest (minutes)<input required min={draft.minimumRequiredStopMinutes || "0"} type="number" value={draft.plannedStopDurationMinutes} onChange={(event) => setDraft({ ...draft, plannedStopDurationMinutes: event.target.value })} /></label></>}<label>Country code <span>(optional)</span><input maxLength={2} value={draft.countryCode} onChange={(event) => setDraft({ ...draft, countryCode: event.target.value })} placeholder="VN" /></label><label className="rc-wide">Notes <span>(optional; include welfare or health check instructions)</span><textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label></div><div className="rc-editor-actions"><button className="rc-light-button" type="button" onClick={() => setEditingId(null)}>Cancel</button><button className="rc-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save stop"}</button></div></form>}
  </div>;
}

export default function RoutePlanTimelineEditor({ orderId, orderCode, orderOrigin, orderDestination, requestedDeliveryDate, returnedReason, horseCount, transportMode, queueHref, service }: Props) {
  const [plan, setPlan] = useState<RoutePlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [splitAfterId, setSplitAfterId] = useState<string | null>(null);
  const [splitArrivalAt, setSplitArrivalAt] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<LegDraft>(emptyLegDraft);
  const [roadSetupId, setRoadSetupId] = useState<string | null>(null);
  const [roadDirty, setRoadDirty] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const canEdit = Boolean(plan && !plan.readOnly);
  const loadPlan = useCallback(async () => {
    setLoading(true); setError("");
    try { setPlan(await service.getRoutePlan(orderId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Route Plan could not be loaded."); }
    finally { setLoading(false); }
  }, [orderId, service]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadPlan(); }, 0); return () => window.clearTimeout(timer); }, [loadPlan]);

  const selectedIndex = editingId ? plan?.legs.findIndex((leg) => leg.id === editingId) ?? -1 : -1;
  const selectedLeg = editingId ? plan?.legs.find((leg) => leg.id === editingId) ?? null : null;
  const splitLeg = splitAfterId ? plan?.legs.find((leg) => leg.id === splitAfterId) ?? null : null;
  const validationIssues = plan?.validationIssues ?? [];
  const finalArrivalTime = (leg: RoutePlanLeg) => localDateTime(leg.plannedArrivalAt).slice(11, 16);
  const formatSchedule = (leg: RoutePlanLeg) => `${showTime(leg.plannedDepartureAt)} → ${showTime(leg.plannedArrivalAt)}`;

  function startAdd() {
    if (!plan) return;
    const previous = plan.legs.at(-1);
    setEditingId(null); setSplitAfterId(null); setAdding(true); setRoadSetupId(null);
    setDraft({ ...emptyLegDraft, origin: previous?.destination ?? orderOrigin, destination: orderDestination, plannedDepartureAt: "", plannedArrivalAt: requestedDeliveryDate ? `${requestedDeliveryDate}T12:00` : "" });
  }
  function startEdit(leg: RoutePlanLeg) {
    const final = plan?.legs.at(-1)?.id === leg.id;
    setSplitAfterId(null); setSplitArrivalAt(""); setAdding(false); setEditingId(leg.id); setRoadSetupId(null);
    setDraft({ ...draftFor(leg), ...(final && requestedDeliveryDate ? { plannedArrivalAt: `${requestedDeliveryDate}T${finalArrivalTime(leg)}` } : {}) });
  }
  function startSplit(leg: RoutePlanLeg) {
    const originalDeparture = localDateTime(leg.plannedDepartureAt);
    const originalArrival = localDateTime(leg.plannedArrivalAt);
    const startMs = new Date(`${originalDeparture}:00Z`).getTime();
    const endMs = new Date(`${originalArrival}:00Z`).getTime();
    const midpoint = Number.isFinite(startMs) && endMs - startMs >= 180_000
      ? shiftLocalDateTime(originalDeparture, Math.floor((endMs - startMs) / 120_000))
      : shiftLocalDateTime(originalDeparture, 1);
    const departureFromConnection = shiftLocalDateTime(midpoint, 1);
    const finalLeg = plan?.legs.at(-1)?.id === leg.id;
    const continuedArrival = finalLeg && requestedDeliveryDate
      ? `${requestedDeliveryDate}T${originalArrival.slice(11, 16)}`
      : originalArrival;
    setEditingId(null); setAdding(false); setSplitAfterId(leg.id); setSplitArrivalAt(midpoint); setRoadSetupId(null);
    setDraft({ ...emptyLegDraft, legType: leg.legType, origin: "", destination: leg.destination, plannedDepartureAt: departureFromConnection, plannedArrivalAt: continuedArrival, airProviderName: leg.airProviderName ?? "", airReference: leg.airReference ?? "", airCapacityHorses: leg.airCapacityHorses?.toString() ?? "" });
  }
  function closeEditor() { setEditingId(null); setSplitAfterId(null); setSplitArrivalAt(""); setAdding(false); setDraft(emptyLegDraft); }

  async function saveLeg(event: FormEvent) {
    event.preventDefault();
    if (!plan) return;
    const priorLeg = splitLeg ?? (selectedIndex > 0 ? plan.legs[selectedIndex - 1] : adding && plan.legs.length ? plan.legs.at(-1) : null);
    const nextLeg = splitLeg ? plan.legs[plan.legs.findIndex((leg) => leg.id === splitLeg.id) + 1] : selectedIndex >= 0 ? plan.legs[selectedIndex + 1] : null;
    const departure = draft.plannedDepartureAt;
    const arrival = draft.plannedArrivalAt;
    if (splitLeg && (!splitArrivalAt || splitArrivalAt <= localDateTime(splitLeg.plannedDepartureAt) || splitArrivalAt >= departure)) {
      setError("Set the connection arrival after this leg departs and before the next leg leaves."); return;
    }
    if (priorLeg && departure <= (splitLeg ? splitArrivalAt : localDateTime(priorLeg.plannedArrivalAt))) {
      setError("This leg must depart after the previous leg arrives."); return;
    }
    if (!arrival || departure >= arrival) { setError("Each leg must arrive after it departs."); return; }
    if (nextLeg && arrival >= localDateTime(nextLeg.plannedDepartureAt)) { setError("This leg must arrive before the next leg departs."); return; }
    if ((editingFinal || (adding && plan.legs.length === 0)) && requestedDeliveryDate && arrival.slice(0, 10) !== requestedDeliveryDate) {
      setError("The final planned arrival date must match the Customer requested delivery date."); return;
    }
    const input = inputForDraft(draft);
    setBusy(true); setError(""); setNotice("");
    try {
      if (splitLeg && splitAfterId) {
        const index = plan.legs.findIndex((leg) => leg.id === splitLeg.id);
        const old = inputFor(splitLeg);
        const connectionArrival = `${splitArrivalAt}:00`;
        await service.saveRouteLeg(orderId, { ...old, destination: input.origin, plannedArrivalAt: connectionArrival }, splitLeg.id);
        let createdId: string | null = null;
        try {
          const beforeIds = new Set(plan.legs.map((leg) => leg.id));
          let saved = await service.saveRouteLeg(orderId, input);
          const created = saved.legs.find((leg) => !beforeIds.has(leg.id));
          if (!created) throw new Error("The new route leg could not be found. Refresh the Route Plan.");
          createdId = created.id;
          while (saved.legs.findIndex((leg) => leg.id === created.id) > index + 1) saved = await service.moveRouteLeg(orderId, created.id, "UP");
          setPlan(saved);
        } catch (caught) {
          if (createdId) try { await service.deleteRouteLeg(orderId, createdId); } catch { /* Continue best-effort rollback. */ }
          try { await service.saveRouteLeg(orderId, old, splitLeg.id); } catch { /* Show the saved state on refresh. */ }
          throw caught;
        }
        setNotice("Connection added. Both legs now share the same connection point.");
      } else if (selectedLeg && selectedIndex >= 0) {
        const previous = plan.legs[selectedIndex - 1]; const next = plan.legs[selectedIndex + 1];
        const originals = [previous, selectedLeg, next].filter((leg): leg is RoutePlanLeg => Boolean(leg));
        const savedIds: string[] = [];
        try {
          if (previous && !samePlace(previous.destination, input.origin)) { await service.saveRouteLeg(orderId, { ...inputFor(previous), destination: input.origin }, previous.id); savedIds.push(previous.id); }
          await service.saveRouteLeg(orderId, input, selectedLeg.id); savedIds.push(selectedLeg.id);
          if (next && !samePlace(next.origin, input.destination)) { await service.saveRouteLeg(orderId, { ...inputFor(next), origin: input.destination }, next.id); savedIds.push(next.id); }
          setPlan(await service.getRoutePlan(orderId));
        } catch (caught) {
          for (const savedId of savedIds.reverse()) {
            const original = originals.find((leg) => leg.id === savedId);
            if (original) try { await service.saveRouteLeg(orderId, inputFor(original), original.id); } catch { /* Best-effort rollback; refresh will show persisted state. */ }
          }
          throw caught;
        }
        setNotice("Leg updated. Adjacent connection points have been synchronized.");
      } else {
        setPlan(await service.saveRouteLeg(orderId, input));
        setNotice("Journey leg added to the Route Plan.");
      }
      closeEditor();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This leg could not be saved."); }
    finally { setBusy(false); }
  }

  async function moveLeg(leg: RoutePlanLeg, direction: "UP" | "DOWN") {
    setBusy(true); setError("");
    try { setPlan(await service.moveRouteLeg(orderId, leg.id, direction)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Leg order could not be changed."); }
    finally { setBusy(false); }
  }
  async function deleteLeg(leg: RoutePlanLeg) {
    if (!window.confirm(`Remove Leg ${leg.sequenceNo}?`)) return;
    setBusy(true); setError("");
    try { setPlan(await service.deleteRouteLeg(orderId, leg.id)); if (editingId === leg.id) closeEditor(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Leg could not be removed."); }
    finally { setBusy(false); }
  }
  async function checkRoute() {
    setBusy(true); setError(""); setNotice("");
    try { const saved = await service.validateRoutePlan(orderId); setPlan(saved); setNotice(saved.validationIssues.length ? "Fix the highlighted items before submitting this Route Plan." : "All saved legs passed the route check. You can submit the plan for review."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Route Plan could not be checked."); }
    finally { setBusy(false); }
  }
  async function submitRoute() {
    setBusy(true); setError(""); setNotice("");
    try { setPlan(await service.submitRoutePlan(orderId)); setConfirmSubmit(false); setNotice("Route Plan submitted to the Logistics Manager."); closeEditor(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Route Plan could not be submitted."); setConfirmSubmit(false); try { setPlan(await service.getRoutePlan(orderId)); } catch { /* Retain the actionable error. */ } }
    finally { setBusy(false); }
  }

  const hasChanges = Boolean(editingId || splitAfterId || adding || roadDirty);
  const issueCount = validationIssues.length;
  const routeIssues = useMemo(() => validationIssues, [validationIssues]);

  if (loading) return <div className="route-plan-workspace-loading" role="status">Loading the saved Route Plan…</div>;
  if (!plan) return <section className="route-plan-workspace-unavailable" role="alert"><h1>Route Plan unavailable</h1><p>{error}</p><button type="button" onClick={() => void loadPlan()}>Try again</button></section>;
  const loadedPlan = plan;

  const openEditorFor = (leg: RoutePlanLeg) => editingId === leg.id || splitAfterId === leg.id;
  const editingFinal = splitAfterId ? splitLeg?.id === plan.legs.at(-1)?.id : adding || selectedIndex === plan.legs.length - 1;
  const originLocked = Boolean(!splitAfterId && (editingId ? selectedIndex === 0 : adding ? plan.legs.length === 0 : true));
  const destinationLocked = Boolean(splitAfterId || !editingId || selectedIndex === plan.legs.length - 1);
  const canSubmit = canEdit && plan.legs.length > 0 && !hasChanges && !busy;

  function renderEditor(isSplit: boolean) {
    const splitIndex = splitLeg ? loadedPlan.legs.findIndex((leg) => leg.id === splitLeg.id) : -1;
    const previousLeg = isSplit ? splitLeg : selectedIndex > 0 ? loadedPlan.legs[selectedIndex - 1] : adding && loadedPlan.legs.length ? loadedPlan.legs.at(-1) : null;
    const nextLeg = isSplit ? loadedPlan.legs[splitIndex + 1] : selectedIndex >= 0 ? loadedPlan.legs[selectedIndex + 1] : null;
    const departureMin = isSplit && splitArrivalAt ? shiftLocalDateTime(splitArrivalAt, 1) : previousLeg ? shiftLocalDateTime(localDateTime(previousLeg.plannedArrivalAt), 1) : undefined;
    const departureMax = draft.plannedArrivalAt ? shiftLocalDateTime(draft.plannedArrivalAt, -1) : undefined;
    const arrivalMin = draft.plannedDepartureAt ? shiftLocalDateTime(draft.plannedDepartureAt, 1) : undefined;
    const arrivalMax = nextLeg ? shiftLocalDateTime(localDateTime(nextLeg.plannedDepartureAt), -1) : undefined;
    const connectionArrivalMin = splitLeg ? shiftLocalDateTime(localDateTime(splitLeg.plannedDepartureAt), 1) : undefined;
    const connectionArrivalMax = [
      splitLeg ? shiftLocalDateTime(localDateTime(splitLeg.plannedArrivalAt), -1) : undefined,
      draft.plannedDepartureAt ? shiftLocalDateTime(draft.plannedDepartureAt, -1) : undefined,
    ].filter((value): value is string => Boolean(value)).sort()[0];
    const finalArrivalTimeMin = requestedDeliveryDate && draft.plannedDepartureAt.slice(0, 10) === requestedDeliveryDate
      ? shiftLocalDateTime(draft.plannedDepartureAt, 1).slice(11, 16)
      : undefined;
    return <form className="rc-editor" onSubmit={(event) => void saveLeg(event)}>
      <div className="rc-editor-title"><div><strong>{isSplit ? "Add a connection" : editingId ? "Edit journey leg" : "Add journey leg"}</strong><small>{isSplit ? "The existing leg will end at this point; the new leg continues the journey." : "Order endpoints stay fixed. Adjacent connection points stay in sync."}</small></div><button type="button" aria-label="Close leg editor" onClick={closeEditor}>×</button></div>
      <div className="rc-editor-grid">
        <label>Travel type<select value={draft.legType} onChange={(event) => setDraft({ ...draft, legType: event.target.value as RouteLegType })}><option value="ROAD">ROAD</option><option value="AIR">AIR</option></select></label>
        <label>Origin<input required readOnly={originLocked} value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} /><small>{originLocked ? "Set by the Order" : "Connection point · updates previous leg destination"}</small></label>
        <label>Destination<input required readOnly={destinationLocked} value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} /><small>{destinationLocked ? "Set by the Order / selected leg" : "Connection point · updates next leg origin"}</small></label>
        {isSplit && splitLeg && <label>Arrive at connection<input required type="datetime-local" min={connectionArrivalMin} max={connectionArrivalMax} value={splitArrivalAt} onChange={(event) => { const nextArrival = event.target.value; setSplitArrivalAt(nextArrival); if (draft.plannedDepartureAt <= nextArrival) setDraft((current) => ({ ...current, plannedDepartureAt: shiftLocalDateTime(nextArrival, 1) })); }} /><small>The previous leg will end at this time.</small></label>}
        <label>{isSplit ? "Depart from connection" : "Departure"}<input required type="datetime-local" min={departureMin} max={departureMax} value={draft.plannedDepartureAt} onChange={(event) => setDraft({ ...draft, plannedDepartureAt: event.target.value })} />{previousLeg && <small>Must be after the previous arrival.</small>}</label>
        {editingFinal && requestedDeliveryDate ? <div className="rc-final-arrival"><div><span>Customer requested delivery</span><strong>{showDate(requestedDeliveryDate)}</strong><small>Date follows the Order</small></div><label>Arrival time<input required type="time" min={finalArrivalTimeMin} value={draft.plannedArrivalAt.slice(11, 16)} onChange={(event) => setDraft({ ...draft, plannedArrivalAt: `${requestedDeliveryDate}T${event.target.value}` })} /></label></div> : <label>Arrival<input required type="datetime-local" min={arrivalMin} max={arrivalMax} value={draft.plannedArrivalAt} onChange={(event) => setDraft({ ...draft, plannedArrivalAt: event.target.value })} />{editingFinal && !requestedDeliveryDate && <small>No date was provided on this legacy Order.</small>}</label>}
        {draft.legType === "AIR" && <><label>Provider<input required value={draft.airProviderName} onChange={(event) => setDraft({ ...draft, airProviderName: event.target.value })} placeholder="Airline or cargo provider" /></label><label>Flight / booking reference<input required value={draft.airReference} onChange={(event) => setDraft({ ...draft, airReference: event.target.value })} /></label><label>Horse capacity<input required min="1" type="number" value={draft.airCapacityHorses} onChange={(event) => setDraft({ ...draft, airCapacityHorses: event.target.value })} /></label></>}
        <label className="rc-wide">Additional details <span>(optional)</span><textarea rows={2} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Equipment, handling or route notes" /></label>
      </div>
      <div className="rc-editor-actions"><button type="button" className="rc-light-button" onClick={closeEditor}>Cancel</button><button className="rc-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : isSplit ? "Save connection" : "Save leg"}</button></div>
    </form>;
  }

  return <main className="route-concept-page route-plan-workspace"><div className="rc-topbar"><Link href={queueHref}>← Fleet &amp; Route Coordinator</Link><span>ROUTE PLANNING</span></div>
    <section className="rc-shell">
      <div className="rc-orderline"><span className="rc-tag">ROUTE PLAN</span><span className={`rc-status${plan.status === "RETURNED" ? " is-returned" : ""}`}>{statusLabel(plan.status)}</span><span className="rc-order-id">Order {orderCode}</span></div>
      <div className="rc-heading"><div><h1>Plan the horse journey</h1><p>Travel directly or split the route into as many legs as needed. Add welfare stops where they make sense.</p></div></div>
      <div className="rc-endpoints"><div><small>ORDER ORIGIN</small><strong>{orderOrigin}</strong><span>Set by the Order</span></div><div className="rc-endpoint-line"><i>✦</i></div><div><small>ORDER DESTINATION</small><strong>{orderDestination}</strong><span>Set by the Order</span>{requestedDeliveryDate && <><b className="rc-desired-label">CUSTOMER DESIRED DELIVERY</b><strong className="rc-desired-date">{showDate(requestedDeliveryDate)}</strong></>}</div></div>
      <div className="rc-checks"><span><b>✓</b> Direct route or split into connected legs</span><span><b>✓</b> ROAD welfare and health stops are optional</span><span className="rc-count">{transportMode} · {horseCount} {horseCount === 1 ? "horse" : "horses"}</span></div>
      {plan.status === "RETURNED" && returnedReason && <div className="rc-return-reason"><strong>Returned by Logistics Manager</strong><span>{returnedReason}</span></div>}
      <section className="rc-journey"><div className="rc-section-head"><div><h2>Journey sequence</h2><p>Use Edit leg to adjust route, travel type and schedule.</p></div>{!plan.readOnly && <button type="button" className="rc-primary-button" onClick={startAdd}>{plan.legs.length ? "＋ Add another leg" : "＋ Add direct journey"}</button>}</div>
        {error && <p className="rc-error" role="alert">{error}</p>}{notice && <p className="rc-feedback" role="status">{notice}</p>}
        {routeIssues.length > 0 && <section className="rc-validation" aria-label="Route issues"><strong>Fix these before submission</strong><span>{issueCount} {issueCount === 1 ? "issue" : "issues"}</span><ul>{routeIssues.map((issue, index) => <li key={`${issue.code}-${issue.legId}-${index}`}><button type="button" disabled={!issue.legId} onClick={() => { const leg = plan.legs.find((candidate) => candidate.id === issue.legId); if (leg && !plan.readOnly) startEdit(leg); }}><b>{issue.code.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</b><span>{issue.message}</span></button></li>)}</ul></section>}
        <div className="rc-timeline">
          <div className="rc-endpoint"><i className="rc-dot rc-dot-start"/><div><small>START</small><strong>{orderOrigin}</strong></div><em>Order origin</em></div>
          {plan.legs.map((leg, index) => <Fragment key={leg.id}><div className="rc-leg-wrap"><div className="rc-line-node"/><article className={`rc-leg-card${openEditorFor(leg) ? " is-open" : ""}`}>
            <header className="rc-leg-head"><div className="rc-leg-title"><span className={`rc-leg-type is-${leg.legType.toLowerCase()}`}>{leg.legType}</span><strong>Leg {index + 1}</strong><small>{formatSchedule(leg)}</small></div>{!plan.readOnly && <div className="rc-card-actions"><button type="button" className="rc-light-button" onClick={() => startEdit(leg)}>Edit leg</button><button type="button" className="rc-remove" onClick={() => startSplit(leg)}>Split this leg</button><button type="button" className="rc-remove" onClick={() => void deleteLeg(leg)} disabled={busy}>Remove</button><button type="button" className="rc-move" title="Move leg up" disabled={busy || index === 0} onClick={() => void moveLeg(leg, "UP")}>↑</button><button type="button" className="rc-move" title="Move leg down" disabled={busy || index === plan.legs.length - 1} onClick={() => void moveLeg(leg, "DOWN")}>↓</button></div>}</header>
            <div className="rc-leg-route"><div><small>FROM</small><strong>{leg.origin}</strong><span>{showTime(leg.plannedDepartureAt)}</span></div><b aria-hidden="true">⟶</b><div><small>TO</small><strong>{leg.destination}</strong><span>{showTime(leg.plannedArrivalAt)}</span></div></div>
            {editingId === leg.id && renderEditor(false)}
            {splitAfterId === leg.id && renderEditor(true)}
            {leg.legType === "ROAD" && <CheckpointStops key={leg.id} orderId={orderId} leg={leg} service={service} readOnly={plan.readOnly} />}
            {leg.legType === "ROAD" && !plan.readOnly && <div className="rc-road-setup-toggle"><button type="button" aria-expanded={roadSetupId === leg.id} onClick={() => setRoadSetupId(roadSetupId === leg.id ? null : leg.id)}><span>{roadSetupId === leg.id ? "Hide vehicle & horse allocation" : "Vehicle & horse allocation"}</span><span className="rc-allocation-chevron" aria-hidden="true">{roadSetupId === leg.id ? "⌃" : "⌄"}</span></button></div>}
            {roadSetupId === leg.id && leg.legType === "ROAD" && <RoadLegSetup orderId={orderId} leg={leg} service={service} readOnly={plan.readOnly} onDirtyChange={setRoadDirty} onClose={() => { setRoadDirty(false); setRoadSetupId(null); }} />}
            {leg.legType === "AIR" && <div className="rc-air-summary"><strong>✈ Air transport details</strong><span>{leg.airProviderName || "Provider not set"} · {leg.airReference || "No booking reference"} · {leg.airCapacityHorses ?? "—"} horses capacity</span></div>}
          </article></div></Fragment>)}
          {adding && !plan.readOnly && <div className="rc-leg-wrap"><div className="rc-line-node"/><article className="rc-leg-card is-open">{renderEditor(false)}</article></div>}
          <div className="rc-endpoint"><i className="rc-dot rc-dot-end"/><div><small>DESTINATION</small><strong>{orderDestination}</strong></div>{requestedDeliveryDate && <em>Planned by {showDate(requestedDeliveryDate)}</em>}</div>
        </div>
        {plan.legs.length === 0 && !editingId && !splitAfterId && !adding && <p className="rc-empty-note">No journey legs yet. Add a direct journey to get started.</p>}
      </section>
      <footer className="rc-footer"><div><strong>{plan.readOnly ? "Route Plan locked" : "Before submitting"}</strong><span>{plan.readOnly ? "This plan is waiting for Logistics Manager review." : "Check route continuity, schedule, vehicle/horse allocation and required details."}</span></div><div className="rc-footer-actions"><button className="rc-light-button" type="button" disabled={!canEdit || busy || hasChanges} onClick={() => void checkRoute()}>{busy ? "Checking…" : "Check entire route"}</button><button className="rc-primary-button" type="button" disabled={!canSubmit || issueCount > 0} onClick={() => setConfirmSubmit(true)}>{plan.status === "RETURNED" ? "Resubmit to LM" : "Submit to LM"}</button></div></footer>
    </section>
    {confirmSubmit && <div className="rc-confirm-backdrop" role="presentation"><section className="rc-confirm" role="dialog" aria-modal="true" aria-labelledby="rc-confirm-title"><h2 id="rc-confirm-title">Submit this Route Plan?</h2><p>The saved plan will be locked while the Logistics Manager reviews it.</p><div><button type="button" className="rc-light-button" onClick={() => setConfirmSubmit(false)}>Cancel</button><button type="button" className="rc-primary-button" disabled={busy} onClick={() => void submitRoute()}>Confirm submit</button></div></section></div>}
  </main>;
}
