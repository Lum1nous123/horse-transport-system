"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import RoadLegSetup from "@/components/RoadLegSetup";
import ValidationResultDialog from "@/components/ValidationResultDialog";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
  type RouteLegInput,
  type RouteLegType,
  type RoutePlanDetail,
  type RoutePlanLeg,
} from "@/lib/fleet-route-coordinator/service";

type Props = {
  orderId: string;
  orderOrigin: string;
  orderDestination: string;
  service: FleetRouteCoordinatorService;
};
type ValidationNotice = { kind: "success" | "attention"; title: string; message: string; issueCount: number };
type LegForm = {
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

const emptyForm: LegForm = {
  legType: "ROAD", origin: "", destination: "", plannedDepartureAt: "", plannedArrivalAt: "",
  airProviderName: "", airReference: "", airCapacityHorses: "", equipmentDetails: "", notes: "",
};

function toInputDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formFor(leg: RoutePlanLeg): LegForm {
  return {
    legType: leg.legType, origin: leg.origin, destination: leg.destination,
    plannedDepartureAt: toInputDateTime(leg.plannedDepartureAt), plannedArrivalAt: toInputDateTime(leg.plannedArrivalAt),
    airProviderName: leg.airProviderName ?? "", airReference: leg.airReference ?? "",
    airCapacityHorses: leg.airCapacityHorses?.toString() ?? "", equipmentDetails: leg.equipmentDetails ?? "", notes: leg.notes ?? "",
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: RoutePlanDetail["status"]) {
  if (status === "PENDING_LM_REVIEW") return "Awaiting LM review";
  if (status === "NOT_STARTED") return "Not started";
  if (status === "RETURNED") return "Returned";
  return status[0] + status.slice(1).toLowerCase();
}

function issueLabel(code: string) {
  return code.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase());
}

function issueTargetsRoadSetup(code: string) {
  return code.startsWith("ROAD_") || code.includes("VEHICLE") || code.includes("HORSE") || code.includes("CHECKPOINT");
}

function inputForLeg(leg: RoutePlanLeg): RouteLegInput {
  return {
    legType: leg.legType,
    origin: leg.origin,
    destination: leg.destination,
    plannedDepartureAt: leg.plannedDepartureAt,
    plannedArrivalAt: leg.plannedArrivalAt,
    airProviderName: leg.airProviderName,
    airReference: leg.airReference,
    airCapacityHorses: leg.airCapacityHorses,
    equipmentDetails: leg.equipmentDetails,
    notes: leg.notes,
  };
}

function samePlace(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

export default function RoutePlanEditor({ orderId, orderOrigin, orderDestination, service }: Props) {
  const [plan, setPlan] = useState<RoutePlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LegForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<LegForm>(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<RoutePlanLeg | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [roadLegId, setRoadLegId] = useState<string | null>(null);
  const [roadSetupDirty, setRoadSetupDirty] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [splitAfterLegId, setSplitAfterLegId] = useState<string | null>(null);
  const [validationNotice, setValidationNotice] = useState<ValidationNotice | null>(null);

  const dirty = showForm && JSON.stringify(form) !== JSON.stringify(initialForm);
  const selectedIssues = useMemo(() => plan?.validationIssues.filter((issue) => !issue.legId || issue.legId === editingId) ?? [], [editingId, plan]);

  const readBack = useCallback(async () => {
    const saved = await service.getRoutePlan(orderId);
    setPlan(saved);
    return saved;
  }, [orderId, service]);

  const loadPlan = useCallback(async () => {
    setLoading(true); setError("");
    try { await readBack(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't load the Route Plan."); }
    finally { setLoading(false); }
  }, [readBack]);

  useEffect(() => { const timer = window.setTimeout(() => { void loadPlan(); }, 0); return () => window.clearTimeout(timer); }, [loadPlan]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function canLeaveDraft() { return !dirty || window.confirm("Discard the unsaved changes to this leg?"); }
  function canLeaveRoadSetup() { return !roadSetupDirty || window.confirm("Discard unsaved ROAD setup changes?"); }
  function beginAdd() {
    if (!canLeaveDraft() || !canLeaveRoadSetup() || !plan) return;
    const next = { ...emptyForm, origin: orderOrigin, destination: orderDestination };
    setRoadLegId(null); setEditingId(null); setSplitAfterLegId(null); setForm(next); setInitialForm(next); setShowAdditionalDetails(false); setShowForm(true); setFeedback("");
  }
  function beginSplit(leg: RoutePlanLeg) {
    if (!canLeaveDraft() || !canLeaveRoadSetup()) return;
    const next = { ...emptyForm, origin: "", destination: leg.destination };
    setRoadLegId(null); setEditingId(null); setSplitAfterLegId(leg.id); setForm(next); setInitialForm(next); setShowAdditionalDetails(false); setShowForm(true); setFeedback("");
  }
  function beginEdit(leg: RoutePlanLeg) {
    if (!canLeaveDraft() || !canLeaveRoadSetup() || !plan) return;
    const index = plan.legs.findIndex((candidate) => candidate.id === leg.id);
    const next = {
      ...formFor(leg),
      origin: index === 0 ? orderOrigin : plan.legs[index - 1]?.destination ?? leg.origin,
      destination: index === plan.legs.length - 1 ? orderDestination : leg.destination,
    };
    setRoadLegId(null); setEditingId(leg.id); setSplitAfterLegId(null); setForm(next); setInitialForm(next); setShowAdditionalDetails(Boolean(next.equipmentDetails || next.notes)); setShowForm(true); setFeedback("");
  }
  function toggleRoadSetup(leg: RoutePlanLeg) { if (roadLegId !== leg.id && !canLeaveRoadSetup()) return; if (!canLeaveDraft()) return; closeForm(); setRoadSetupDirty(false); setRoadLegId((current) => current === leg.id ? null : leg.id); }
  function closeForm() { setShowForm(false); setEditingId(null); setSplitAfterLegId(null); setForm(emptyForm); setInitialForm(emptyForm); setShowAdditionalDetails(false); }
  function update<K extends keyof LegForm>(key: K, value: LegForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function inputFromForm(): RouteLegInput {
    return {
      legType: form.legType, origin: form.origin.trim(), destination: form.destination.trim(),
      plannedDepartureAt: new Date(form.plannedDepartureAt).toISOString(), plannedArrivalAt: new Date(form.plannedArrivalAt).toISOString(),
      airProviderName: form.legType === "AIR" ? form.airProviderName.trim() || null : null,
      airReference: form.legType === "AIR" ? form.airReference.trim() || null : null,
      airCapacityHorses: form.legType === "AIR" && form.airCapacityHorses ? Number(form.airCapacityHorses) : null,
      equipmentDetails: form.equipmentDetails.trim() || null, notes: form.notes.trim() || null,
    };
  }

  async function runMutation(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setFeedback("");
    try { await action(); await readBack(); setFeedback(success); return true; }
    catch (caught) {
      const message = caught instanceof Error ? caught.message : "The Route Plan couldn't be updated.";
      setError(message);
      if (caught instanceof CoordinatorWorkspaceError && ["LOCKED", "STALE_STATE", "VALIDATION_FAILED"].includes(caught.code)) {
        try { await readBack(); } catch { /* retain the actionable mutation error */ }
      }
      return false;
    } finally { setBusy(false); }
  }

  async function saveLeg(event: FormEvent) {
    event.preventDefault();
    const input = inputFromForm();
    const persistLeg = async () => {
      if (!editingId && splitAfterLegId) {
        const splitLeg = plan?.legs.find((leg) => leg.id === splitAfterLegId);
        const splitIndex = plan?.legs.findIndex((leg) => leg.id === splitAfterLegId) ?? -1;
        if (!splitLeg || splitIndex < 0 || !plan) throw new Error("The selected route leg is no longer available. Refresh the Route Plan.");
        const splitInput = inputForLeg(splitLeg);
        const existingLegIds = new Set(plan.legs.map((leg) => leg.id));
        let createdLegId: string | null = null;
        await service.saveRouteLeg(orderId, { ...splitInput, destination: input.origin }, splitLeg.id);
        try {
          let result = await service.saveRouteLeg(orderId, input);
          const createdLeg = result.legs.find((leg) => !existingLegIds.has(leg.id));
          if (!createdLeg) throw new Error("The inserted route leg could not be identified. Refresh the Route Plan.");
          createdLegId = createdLeg.id;
          for (let currentIndex = result.legs.findIndex((leg) => leg.id === createdLeg.id); currentIndex > splitIndex + 1; currentIndex -= 1) {
            result = await service.moveRouteLeg(orderId, createdLeg.id, "UP");
          }
          return result;
        } catch (caught) {
          if (createdLegId) try { await service.deleteRouteLeg(orderId, createdLegId); } catch { /* continue best-effort rollback */ }
          try { await service.saveRouteLeg(orderId, splitInput, splitLeg.id); } catch { /* read-back will expose an incomplete rollback */ }
          throw caught;
        }
      }

      const saved = await service.saveRouteLeg(orderId, input, editingId ?? undefined);
      if (editingId && plan) {
        const currentIndex = plan.legs.findIndex((leg) => leg.id === editingId);
        const nextLeg = plan.legs[currentIndex + 1];
        if (nextLeg && !samePlace(nextLeg.origin, input.destination)) {
          await service.saveRouteLeg(orderId, { ...inputForLeg(nextLeg), origin: input.destination }, nextLeg.id);
        }
      }
      return saved;
    };
    if (await runMutation(persistLeg, editingId ? "Leg and route connection updated." : splitAfterLegId ? "Connection point inserted into the selected leg." : "First leg added to the saved Route Plan.")) closeForm();
  }
  async function moveLeg(leg: RoutePlanLeg, direction: "UP" | "DOWN") { await runMutation(() => service.moveRouteLeg(orderId, leg.id, direction), `Leg ${direction === "UP" ? "moved up" : "moved down"}.`); }
  async function deleteLeg() { if (!pendingDelete) return; if (await runMutation(() => service.deleteRouteLeg(orderId, pendingDelete.id), "Leg removed from the saved Route Plan.")) { if (editingId === pendingDelete.id) closeForm(); setPendingDelete(null); } }
  async function validatePlan() {
    setBusy(true); setError(""); setFeedback(""); setValidationNotice(null);
    try {
      const result = await service.validateRoutePlan(orderId);
      setPlan(result);
      setValidationNotice(result.validationIssues.length === 0
        ? { kind: "success", title: "Route Plan is ready", message: "All saved journey legs passed the full route check. You can submit the plan for review.", issueCount: 0 }
        : { kind: "attention", title: "Route Plan needs attention", message: "Review the highlighted route issues before submitting to the Logistics Manager.", issueCount: result.validationIssues.length });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The Route Plan couldn't be checked.");
      try { await readBack(); } catch { /* retain validation error */ }
    } finally { setBusy(false); }
  }
  async function submitPlan() { setConfirmSubmit(false); if (await runMutation(() => service.submitRoutePlan(orderId), "Route Plan submitted and locked for Logistics Manager review.")) closeForm(); }

  if (loading) return <section className="route-plan-shell route-plan-loading" aria-label="Loading Route Plan" role="status"><span /><span /><span /></section>;
  if (!plan) return <section className="route-plan-shell route-plan-unavailable" role="alert"><h2>Route Plan unavailable</h2><p>{error}</p><button className="customer-secondary-button" type="button" onClick={() => void loadPlan()}>Try again</button></section>;

  const editingIndex = editingId ? plan.legs.findIndex((leg) => leg.id === editingId) : -1;
  const splitLeg = splitAfterLegId ? plan.legs.find((leg) => leg.id === splitAfterLegId) ?? null : null;
  const originLocked = !splitAfterLegId;
  const destinationLocked = !editingId || editingIndex === plan.legs.length - 1;

  return (
    <section className="route-plan-shell" aria-labelledby="route-plan-title">
      <header className="route-plan-heading">
        <div><span>ROUTE PLAN</span><div><h2 id="route-plan-title">Ordered journey legs</h2><span className={`route-plan-status is-${plan.status.toLowerCase()}`}>{statusLabel(plan.status)}</span></div><p>{plan.legs.length > 0 ? "Use + Connection on the exact leg you want to split." : "Add the first direct leg from the Order origin to destination."}</p></div>
        {!plan.readOnly && plan.legs.length === 0 && <button className="customer-primary-button" type="button" onClick={beginAdd} disabled={busy}>+ Add first leg</button>}
      </header>

      {plan.readOnly && <div className="route-plan-lock" role="status"><span aria-hidden="true">&#128274;</span><div><strong>Route Plan locked</strong><p>{plan.status === "APPROVED" ? "Approved plans cannot be changed." : "Waiting for Logistics Manager review."}</p></div></div>}
      {error && <div className="customer-alert route-plan-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void readBack()}>Refresh saved plan</button></div>}
      {feedback && <p className="customer-feedback" role="status">{feedback}</p>}

      {plan.validationIssues.length > 0 && (
        <section className="route-plan-validation" aria-labelledby="route-validation-title">
          <div><span className="route-plan-validation-icon" aria-hidden="true">!</span><div><strong id="route-validation-title">Fix these before submission</strong><small>Select an issue to open the affected leg.</small></div><span>{plan.validationIssues.length} {plan.validationIssues.length === 1 ? "issue" : "issues"}</span></div>
          <ul>{plan.validationIssues.map((issue, index) => <li key={`${issue.code}-${issue.legId}-${index}`}><button type="button" onClick={() => { const leg = plan.legs.find((candidate) => candidate.id === issue.legId); if (leg && !plan.readOnly) { if (leg.legType === "ROAD" && issueTargetsRoadSetup(issue.code)) toggleRoadSetup(leg); else beginEdit(leg); } }} disabled={!issue.legId || plan.readOnly}><span>{issueLabel(issue.code)}</span>{issue.message}</button></li>)}</ul>
        </section>
      )}

      <div className={`route-plan-layout${showForm ? " has-inspector" : ""}`}>
        <div className="route-plan-table-wrap">
          {plan.legs.length === 0 ? (
            <div className="route-plan-empty"><span aria-hidden="true">&#8644;</span><h3>No journey leg yet</h3><p>Add the first leg to build the journey and validate the plan.</p>{!plan.readOnly && <button className="customer-primary-button" type="button" onClick={beginAdd}>Add first leg</button>}</div>
          ) : (
            <table className="route-plan-table">
              <thead><tr><th scope="col">#</th><th scope="col">Type</th><th scope="col">Route</th><th scope="col">Schedule</th><th scope="col">Setup / details</th>{!plan.readOnly && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>{plan.legs.map((leg, index) => (
                <Fragment key={leg.id}>
                <tr className={editingId === leg.id || roadLegId === leg.id || splitAfterLegId === leg.id ? "is-selected" : undefined}>
                  <td data-label="Sequence"><span className="route-plan-sequence">{leg.sequenceNo}</span></td>
                  <td data-label="Type"><span className={`route-leg-type is-${leg.legType.toLowerCase()}`}>{leg.legType}</span></td>
                  <td data-label="Route"><strong>{leg.origin}</strong><span aria-hidden="true">&#8594;</span><strong>{leg.destination}</strong></td>
                  <td data-label="Schedule"><div className="route-plan-schedule"><span><small>Depart</small>{formatDateTime(leg.plannedDepartureAt)}</span><span><small>Arrive</small>{formatDateTime(leg.plannedArrivalAt)}</span></div></td>
                  <td data-label="Setup / details">{leg.legType === "AIR" ? <><span>{leg.airProviderName || "Not provided"}</span><small>{leg.airReference || "No reference"}{leg.airCapacityHorses ? ` · ${leg.airCapacityHorses} horses` : ""}</small></> : <button className="road-setup-trigger" type="button" aria-expanded={roadLegId === leg.id} onClick={() => toggleRoadSetup(leg)}>{roadLegId === leg.id ? "Close setup" : plan.readOnly ? "View ROAD" : "Configure ROAD"}</button>}</td>
                  {!plan.readOnly && <td data-label="Actions"><div className="route-plan-row-actions"><button type="button" title="Move leg up" disabled={busy || index === 0} onClick={() => void moveLeg(leg, "UP")}>&#8593;</button><button type="button" title="Move leg down" disabled={busy || index === plan.legs.length - 1} onClick={() => void moveLeg(leg, "DOWN")}>&#8595;</button><button className="is-connection" type="button" title={`Split leg ${leg.sequenceNo} at a new connection point`} onClick={() => beginSplit(leg)}>+ Connection</button><button type="button" onClick={() => beginEdit(leg)}>Edit</button><button className="is-danger" type="button" onClick={() => setPendingDelete(leg)}>Delete</button></div></td>}
                </tr>
                {roadLegId === leg.id && <tr className="road-setup-row"><td colSpan={plan.readOnly ? 5 : 6}><RoadLegSetup orderId={orderId} leg={leg} service={service} readOnly={plan.readOnly} onDirtyChange={setRoadSetupDirty} onClose={() => { setRoadSetupDirty(false); setRoadLegId(null); }} /></td></tr>}
                </Fragment>
              ))}</tbody>
            </table>
          )}
        </div>

        {showForm && !plan.readOnly && (
          <aside className="route-plan-inspector" aria-labelledby="route-inspector-title">
            <div className="route-plan-inspector-heading"><div><span>{editingId ? "EDIT LEG" : splitLeg ? "INSERT CONNECTION" : "NEW LEG"}</span><h3 id="route-inspector-title">{editingId ? `Leg ${plan.legs.find((leg) => leg.id === editingId)?.sequenceNo}` : splitLeg ? `Split leg ${splitLeg.sequenceNo}` : "First leg"}</h3></div><button type="button" aria-label="Close editor" onClick={() => { if (canLeaveDraft()) closeForm(); }}>&times;</button></div>
            {selectedIssues.length > 0 && <div className="route-plan-field-issues">{selectedIssues.map((issue, index) => <p key={`${issue.code}-${index}`}>{issue.message}</p>)}</div>}
            <form onSubmit={(event) => void saveLeg(event)}>
              <fieldset><legend>Travel type</legend><div className="route-plan-type-options"><label><input type="radio" name="legType" value="ROAD" checked={form.legType === "ROAD"} onChange={() => update("legType", "ROAD")} /><span>ROAD</span></label><label><input type="radio" name="legType" value="AIR" checked={form.legType === "AIR"} onChange={() => update("legType", "AIR")} /><span>AIR</span></label></div></fieldset>
              <div className="route-plan-boundary-note"><span aria-hidden="true">&#8644;</span><p>{splitLeg ? `Enter a connection point inside leg ${splitLeg.sequenceNo}. The existing leg will end there, and the new leg will continue to ${splitLeg.destination}.` : "Route boundaries and leg continuity are filled from the Order and adjacent legs."}</p></div>
              <label>{splitLeg ? "New connection point" : "Origin"}<input required readOnly={originLocked} aria-readonly={originLocked} value={form.origin} onChange={(event) => update("origin", event.target.value)} />{originLocked && <small>{editingIndex === 0 || plan.legs.length === 0 ? "Order origin" : "From the previous leg"}</small>}</label>
              <label>{destinationLocked ? "Destination" : "Next connection point"}<input required readOnly={destinationLocked} aria-readonly={destinationLocked} value={form.destination} onChange={(event) => update("destination", event.target.value)} />{destinationLocked ? <small>Order destination</small> : <small>This automatically becomes the next leg&apos;s Origin</small>}</label>
              <div className="route-plan-form-row"><label>Departure<input required type="datetime-local" value={form.plannedDepartureAt} onChange={(event) => update("plannedDepartureAt", event.target.value)} /></label><label>Arrival<input required type="datetime-local" value={form.plannedArrivalAt} onChange={(event) => update("plannedArrivalAt", event.target.value)} /></label></div>
              {form.legType === "AIR" && <div className="route-plan-air-fields"><span>AIR DETAILS</span><label>Provider<input required value={form.airProviderName} onChange={(event) => update("airProviderName", event.target.value)} /></label><label>Flight / booking reference<input required value={form.airReference} onChange={(event) => update("airReference", event.target.value)} /></label><label>Horse capacity<input required min="1" type="number" value={form.airCapacityHorses} onChange={(event) => update("airCapacityHorses", event.target.value)} /></label></div>}
              <button className="route-plan-additional-toggle" type="button" aria-expanded={showAdditionalDetails} onClick={() => setShowAdditionalDetails((current) => !current)}><span>Additional details</span><span aria-hidden="true">{showAdditionalDetails ? "−" : "+"}</span></button>
              {showAdditionalDetails && <div className="route-plan-additional-fields"><label>Equipment details <span>(optional)</span><textarea rows={2} value={form.equipmentDetails} onChange={(event) => update("equipmentDetails", event.target.value)} /></label><label>Notes <span>(optional)</span><textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label></div>}
              <div className="route-plan-form-actions"><button className="customer-secondary-button" type="button" onClick={closeForm}>Cancel</button><button className="customer-primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : splitLeg ? "Insert connection" : "Save leg"}</button></div>
            </form>
          </aside>
        )}
      </div>

      <footer className="route-plan-footer">
        <div><span>{plan.updatedAt ? `Last saved ${formatDateTime(plan.updatedAt)}` : "Not saved yet"}</span></div>
        {!plan.readOnly && <div className="route-plan-footer-main">{(showForm || roadLegId) && <div className={`route-plan-footer-context${dirty || roadSetupDirty ? " is-pending" : ""}`}><strong>{dirty || roadSetupDirty ? "Unsaved changes" : `${roadLegId ? "ROAD setup" : "Leg editor"} is open`}</strong><span>{dirty || roadSetupDirty ? "Save or discard them before checking or submitting the full route." : "Full Route Plan actions below use the saved data."}</span></div>}<div className="route-plan-footer-actions"><button className="customer-secondary-button" type="button" title={dirty || roadSetupDirty ? "Save or discard pending changes first." : undefined} disabled={busy || dirty || roadSetupDirty} onClick={() => void validatePlan()}>{busy ? "Checking..." : "Check entire route"}</button><button className="customer-primary-button" type="button" title={dirty || roadSetupDirty ? "Save or discard pending changes first." : undefined} disabled={busy || plan.legs.length === 0 || dirty || roadSetupDirty} onClick={() => setConfirmSubmit(true)}>{plan.status === "RETURNED" ? "Resubmit to LM" : "Submit to LM"}</button></div></div>}
      </footer>

      {validationNotice && <ValidationResultDialog kind={validationNotice.kind} eyebrow="Full Route Plan check" title={validationNotice.title} message={validationNotice.message} issueCount={validationNotice.issueCount} issues={plan.validationIssues.map((issue) => ({ label: issueLabel(issue.code), message: issue.message }))} actionLabel={validationNotice.kind === "success" ? (plan.status === "RETURNED" ? "Resubmit to LM" : "Submit to LM") : undefined} onAction={validationNotice.kind === "success" ? () => { setValidationNotice(null); setConfirmSubmit(true); } : undefined} onClose={() => setValidationNotice(null)} />}

      {(pendingDelete || confirmSubmit) && <div className="route-plan-dialog-backdrop" role="presentation"><div className="route-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="route-plan-dialog-title"><span aria-hidden="true">{pendingDelete ? "!" : "\u2192"}</span><h3 id="route-plan-dialog-title">{pendingDelete ? `Delete leg ${pendingDelete.sequenceNo}?` : plan.status === "RETURNED" ? "Resubmit this Route Plan?" : "Submit this Route Plan?"}</h3><p>{pendingDelete ? "The leg will be removed and the remaining journey will be reordered." : "The saved plan will become read-only while the Logistics Manager reviews it."}</p><div><button className="customer-secondary-button" type="button" disabled={busy} onClick={() => { setPendingDelete(null); setConfirmSubmit(false); }}>Cancel</button><button className="customer-primary-button" type="button" disabled={busy} onClick={() => pendingDelete ? void deleteLeg() : void submitPlan()}>{busy ? "Working..." : pendingDelete ? "Delete leg" : "Confirm submit"}</button></div></div></div>}
    </section>
  );
}
