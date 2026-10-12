"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
  type RouteLegInput,
  type RouteLegType,
  type RoutePlanDetail,
  type RoutePlanLeg,
} from "@/lib/fleet-route-coordinator/service";

type Props = { orderId: string; service: FleetRouteCoordinatorService };
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

export default function RoutePlanEditor({ orderId, service }: Props) {
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
  function beginAdd() { if (!canLeaveDraft()) return; setEditingId(null); setForm(emptyForm); setInitialForm(emptyForm); setShowForm(true); setFeedback(""); }
  function beginEdit(leg: RoutePlanLeg) { if (!canLeaveDraft()) return; const next = formFor(leg); setEditingId(leg.id); setForm(next); setInitialForm(next); setShowForm(true); setFeedback(""); }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(emptyForm); setInitialForm(emptyForm); }
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
    if (await runMutation(() => service.saveRouteLeg(orderId, inputFromForm(), editingId ?? undefined), editingId ? "Leg updated from the saved Route Plan." : "Leg added to the saved Route Plan.")) closeForm();
  }
  async function moveLeg(leg: RoutePlanLeg, direction: "UP" | "DOWN") { await runMutation(() => service.moveRouteLeg(orderId, leg.id, direction), `Leg ${direction === "UP" ? "moved up" : "moved down"}.`); }
  async function deleteLeg() { if (!pendingDelete) return; if (await runMutation(() => service.deleteRouteLeg(orderId, pendingDelete.id), "Leg removed from the saved Route Plan.")) { if (editingId === pendingDelete.id) closeForm(); setPendingDelete(null); } }
  async function validatePlan() { await runMutation(() => service.validateRoutePlan(orderId), "Validation finished using the saved Route Plan."); }
  async function submitPlan() { setConfirmSubmit(false); if (await runMutation(() => service.submitRoutePlan(orderId), "Route Plan submitted and locked for Logistics Manager review.")) closeForm(); }

  if (loading) return <section className="route-plan-shell route-plan-loading" aria-label="Loading Route Plan" role="status"><span /><span /><span /></section>;
  if (!plan) return <section className="route-plan-shell route-plan-unavailable" role="alert"><h2>Route Plan unavailable</h2><p>{error}</p><button className="customer-secondary-button" type="button" onClick={() => void loadPlan()}>Try again</button></section>;

  return (
    <section className="route-plan-shell" aria-labelledby="route-plan-title">
      <header className="route-plan-heading">
        <div><span>ROUTE PLAN</span><div><h2 id="route-plan-title">Ordered journey legs</h2><span className={`route-plan-status is-${plan.status.toLowerCase()}`}>{statusLabel(plan.status)}</span></div><p>Build the journey in travel order. Saved server validation remains authoritative.</p></div>
        {!plan.readOnly && <button className="customer-primary-button" type="button" onClick={beginAdd} disabled={busy}>+ Add leg</button>}
      </header>

      {plan.readOnly && <div className="route-plan-lock" role="status"><span aria-hidden="true">&#128274;</span><div><strong>This Route Plan is read-only</strong><p>{plan.status === "APPROVED" ? "The approved result is permanently locked." : "Changes are locked while Logistics Manager review is pending."}</p></div></div>}
      {error && <div className="customer-alert route-plan-alert" role="alert"><span>{error}</span><button type="button" onClick={() => void readBack()}>Refresh saved plan</button></div>}
      {feedback && <p className="customer-feedback" role="status">{feedback}</p>}

      {plan.validationIssues.length > 0 && (
        <section className="route-plan-validation" aria-labelledby="route-validation-title">
          <div><strong id="route-validation-title">Validation needs attention</strong><span>{plan.validationIssues.length} {plan.validationIssues.length === 1 ? "issue" : "issues"}</span></div>
          <ul>{plan.validationIssues.map((issue, index) => <li key={`${issue.code}-${issue.legId}-${index}`}><button type="button" onClick={() => { const leg = plan.legs.find((candidate) => candidate.id === issue.legId); if (leg && !plan.readOnly) beginEdit(leg); }} disabled={!issue.legId || plan.readOnly}><span>{issue.code.replaceAll("_", " ")}</span>{issue.message}</button></li>)}</ul>
        </section>
      )}

      <div className={`route-plan-layout${showForm ? " has-inspector" : ""}`}>
        <div className="route-plan-table-wrap">
          {plan.legs.length === 0 ? (
            <div className="route-plan-empty"><span aria-hidden="true">&#8644;</span><h3>No journey legs yet</h3><p>Add the first ROAD or AIR leg. Validation and submit use the saved plan.</p>{!plan.readOnly && <button className="customer-primary-button" type="button" onClick={beginAdd}>Add first leg</button>}</div>
          ) : (
            <table className="route-plan-table">
              <thead><tr><th scope="col">#</th><th scope="col">Type</th><th scope="col">Route</th><th scope="col">Departure</th><th scope="col">Arrival</th><th scope="col">AIR details</th>{!plan.readOnly && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>{plan.legs.map((leg, index) => (
                <tr key={leg.id} className={editingId === leg.id ? "is-selected" : undefined}>
                  <td data-label="Sequence"><span className="route-plan-sequence">{leg.sequenceNo}</span></td>
                  <td data-label="Type"><span className={`route-leg-type is-${leg.legType.toLowerCase()}`}>{leg.legType}</span></td>
                  <td data-label="Route"><strong>{leg.origin}</strong><span aria-hidden="true">&#8594;</span><strong>{leg.destination}</strong></td>
                  <td data-label="Departure"><span>{formatDateTime(leg.plannedDepartureAt)}</span></td>
                  <td data-label="Arrival"><span>{formatDateTime(leg.plannedArrivalAt)}</span></td>
                  <td data-label="AIR details">{leg.legType === "AIR" ? <><span>{leg.airProviderName || "Not provided"}</span><small>{leg.airReference || "No reference"}{leg.airCapacityHorses ? ` · ${leg.airCapacityHorses} horses` : ""}</small></> : <span className="route-plan-not-applicable">—</span>}</td>
                  {!plan.readOnly && <td data-label="Actions"><div className="route-plan-row-actions"><button type="button" title="Move leg up" disabled={busy || index === 0} onClick={() => void moveLeg(leg, "UP")}>&#8593;</button><button type="button" title="Move leg down" disabled={busy || index === plan.legs.length - 1} onClick={() => void moveLeg(leg, "DOWN")}>&#8595;</button><button type="button" onClick={() => beginEdit(leg)}>Edit</button><button className="is-danger" type="button" onClick={() => setPendingDelete(leg)}>Delete</button></div></td>}
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>

        {showForm && !plan.readOnly && (
          <aside className="route-plan-inspector" aria-labelledby="route-inspector-title">
            <div className="route-plan-inspector-heading"><div><span>{editingId ? "EDIT LEG" : "NEW LEG"}</span><h3 id="route-inspector-title">{editingId ? `Leg ${plan.legs.find((leg) => leg.id === editingId)?.sequenceNo}` : `Leg ${plan.legs.length + 1}`}</h3></div><button type="button" aria-label="Close editor" onClick={() => { if (canLeaveDraft()) closeForm(); }}>&times;</button></div>
            {selectedIssues.length > 0 && <div className="route-plan-field-issues">{selectedIssues.map((issue, index) => <p key={`${issue.code}-${index}`}>{issue.message}</p>)}</div>}
            <form onSubmit={(event) => void saveLeg(event)}>
              <fieldset><legend>Travel type</legend><div className="route-plan-type-options"><label><input type="radio" name="legType" value="ROAD" checked={form.legType === "ROAD"} onChange={() => update("legType", "ROAD")} /><span>ROAD</span></label><label><input type="radio" name="legType" value="AIR" checked={form.legType === "AIR"} onChange={() => update("legType", "AIR")} /><span>AIR</span></label></div></fieldset>
              <label>Origin<input required value={form.origin} onChange={(event) => update("origin", event.target.value)} /></label>
              <label>Destination<input required value={form.destination} onChange={(event) => update("destination", event.target.value)} /></label>
              <div className="route-plan-form-row"><label>Departure<input required type="datetime-local" value={form.plannedDepartureAt} onChange={(event) => update("plannedDepartureAt", event.target.value)} /></label><label>Arrival<input required type="datetime-local" value={form.plannedArrivalAt} onChange={(event) => update("plannedArrivalAt", event.target.value)} /></label></div>
              {form.legType === "AIR" && <div className="route-plan-air-fields"><span>AIR DETAILS</span><label>Provider<input required value={form.airProviderName} onChange={(event) => update("airProviderName", event.target.value)} /></label><label>Flight / booking reference<input required value={form.airReference} onChange={(event) => update("airReference", event.target.value)} /></label><label>Horse capacity<input required min="1" type="number" value={form.airCapacityHorses} onChange={(event) => update("airCapacityHorses", event.target.value)} /></label></div>}
              <label>Equipment details<textarea rows={2} value={form.equipmentDetails} onChange={(event) => update("equipmentDetails", event.target.value)} /></label>
              <label>Notes <span>(optional)</span><textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
              <div className="route-plan-form-actions"><button className="customer-secondary-button" type="button" onClick={closeForm}>Cancel</button><button className="customer-primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save leg"}</button></div>
            </form>
          </aside>
        )}
      </div>

      <footer className="route-plan-footer">
        <div><strong>Revision {plan.revision}</strong><span>{plan.updatedAt ? `Last saved ${formatDateTime(plan.updatedAt)}` : "Not saved yet"}</span></div>
        {!plan.readOnly && <div><button className="customer-secondary-button" type="button" disabled={busy} onClick={() => void validatePlan()}>{busy ? "Working..." : "Validate plan"}</button><button className="customer-primary-button" type="button" disabled={busy || plan.legs.length === 0} onClick={() => setConfirmSubmit(true)}>{plan.status === "RETURNED" ? "Resubmit for review" : "Submit for review"}</button></div>}
      </footer>

      {(pendingDelete || confirmSubmit) && <div className="route-plan-dialog-backdrop" role="presentation"><div className="route-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="route-plan-dialog-title"><span aria-hidden="true">{pendingDelete ? "!" : "&#8594;"}</span><h3 id="route-plan-dialog-title">{pendingDelete ? `Delete leg ${pendingDelete.sequenceNo}?` : plan.status === "RETURNED" ? "Resubmit this Route Plan?" : "Submit this Route Plan?"}</h3><p>{pendingDelete ? "The leg will be removed and the remaining journey will be reordered." : "The saved plan will become read-only while the Logistics Manager reviews it."}</p><div><button className="customer-secondary-button" type="button" disabled={busy} onClick={() => { setPendingDelete(null); setConfirmSubmit(false); }}>Cancel</button><button className="customer-primary-button" type="button" disabled={busy} onClick={() => pendingDelete ? void deleteLeg() : void submitPlan()}>{busy ? "Working..." : pendingDelete ? "Delete leg" : "Confirm submit"}</button></div></div></div>}
    </section>
  );
}
