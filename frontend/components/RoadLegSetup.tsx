"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ValidationResultDialog from "@/components/ValidationResultDialog";
import {
  CoordinatorWorkspaceError,
  type FleetRouteCoordinatorService,
  type RoadCheckpoint,
  type RoadCheckpointInput,
  type RoadCheckpointType,
  type RoadLegSetup as RoadLegSetupDetail,
  type RoutePlanLeg,
} from "@/lib/fleet-route-coordinator/service";

type Props = {
  orderId: string;
  leg: RoutePlanLeg;
  service: FleetRouteCoordinatorService;
  readOnly: boolean;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};

type CheckpointForm = {
  name: string;
  checkpointType: RoadCheckpointType;
  countryCode: string;
  minimumRequiredStopMinutes: string;
  plannedStopDurationMinutes: string;
  notes: string;
};

type ValidationNotice = {
  kind: "success" | "attention";
  title: string;
  message: string;
  issueCount: number;
};

const emptyCheckpoint: CheckpointForm = {
  name: "", checkpointType: "OTHER", countryCode: "",
  minimumRequiredStopMinutes: "", plannedStopDurationMinutes: "", notes: "",
};

function checkpointFormFor(checkpoint: RoadCheckpoint): CheckpointForm {
  return {
    name: checkpoint.name, checkpointType: checkpoint.checkpointType,
    countryCode: checkpoint.countryCode ?? "",
    minimumRequiredStopMinutes: checkpoint.minimumRequiredStopMinutes?.toString() ?? "",
    plannedStopDurationMinutes: checkpoint.plannedStopDurationMinutes?.toString() ?? "",
    notes: checkpoint.notes ?? "",
  };
}

function checkpointInput(form: CheckpointForm): RoadCheckpointInput {
  const restStop = form.checkpointType === "REST_STOP";
  return {
    name: form.name.trim(), checkpointType: form.checkpointType,
    countryCode: form.countryCode.trim().toUpperCase() || null,
    minimumRequiredStopMinutes: restStop && form.minimumRequiredStopMinutes ? Number(form.minimumRequiredStopMinutes) : null,
    plannedStopDurationMinutes: restStop && form.plannedStopDurationMinutes ? Number(form.plannedStopDurationMinutes) : null,
    notes: form.notes.trim() || null,
  };
}

export default function RoadLegSetup({ orderId, leg, service, readOnly, onClose, onDirtyChange }: Props) {
  const [setup, setSetup] = useState<RoadLegSetupDetail | null>(null);
  const [tab, setTab] = useState<"allocations" | "checkpoints">("allocations");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [horseAssignments, setHorseAssignments] = useState<Record<string, string>>({});
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [checkpointForm, setCheckpointForm] = useState<CheckpointForm>(emptyCheckpoint);
  const [initialCheckpointForm, setInitialCheckpointForm] = useState<CheckpointForm>(emptyCheckpoint);
  const [validationNotice, setValidationNotice] = useState<ValidationNotice | null>(null);

  const hydrateDraft = useCallback((saved: RoadLegSetupDetail) => {
    setSelectedVehicleIds(saved.allocations.map((allocation) => allocation.vehicleId));
    setHorseAssignments(Object.fromEntries(saved.allocations.flatMap((allocation) => allocation.orderHorseIds.map((horseId) => [horseId, allocation.vehicleId]))));
  }, []);

  const readBack = useCallback(async () => {
    const saved = await service.getRoadLegSetup(orderId, leg.id);
    setSetup(saved);
    hydrateDraft(saved);
    return saved;
  }, [hydrateDraft, leg.id, orderId, service]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { await readBack(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't load ROAD setup."); }
    finally { setLoading(false); }
  }, [readBack]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const savedAssignments = useMemo(() => setup ? Object.fromEntries(setup.allocations.flatMap((allocation) => allocation.orderHorseIds.map((horseId) => [horseId, allocation.vehicleId]))) : {}, [setup]);
  const allocationDirty = setup !== null && (JSON.stringify([...selectedVehicleIds].sort()) !== JSON.stringify(setup.allocations.map((allocation) => allocation.vehicleId).sort()) || JSON.stringify(horseAssignments) !== JSON.stringify(savedAssignments));
  const checkpointDirty = showCheckpointForm && JSON.stringify(checkpointForm) !== JSON.stringify(initialCheckpointForm);
  const dirty = allocationDirty || checkpointDirty;

  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const assignedCount = setup?.horses.filter((horse) => Boolean(horseAssignments[horse.orderHorseId])).length ?? 0;
  const capacityUse = useMemo(() => Object.fromEntries(selectedVehicleIds.map((vehicleId) => [vehicleId, Object.values(horseAssignments).filter((assigned) => assigned === vehicleId).length])), [horseAssignments, selectedVehicleIds]);
  const visibleCandidates = useMemo(() => {
    if (!setup) return [];
    const query = vehicleQuery.trim().toLowerCase();
    return setup.candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => !query || [candidate.plateNumber, candidate.vehicleName, candidate.vehicleType].some((value) => value.toLowerCase().includes(query)))
      .sort((left, right) => Number(right.candidate.selectable) - Number(left.candidate.selectable) || left.index - right.index)
      .map(({ candidate }) => candidate);
  }, [setup, vehicleQuery]);

  function safeClose() { if (!dirty || window.confirm("Discard unsaved ROAD setup changes?")) onClose(); }
  function switchTab(next: "allocations" | "checkpoints") {
    if (next === tab) return;
    if (tab === "allocations" && allocationDirty) {
      if (!window.confirm("Discard unsaved Vehicle and Horse allocation changes?")) return;
      if (setup) hydrateDraft(setup);
    }
    if (checkpointDirty && !window.confirm("Discard unsaved checkpoint changes?")) return;
    closeCheckpointForm();
    setTab(next);
  }
  function closeCheckpointForm() { setShowCheckpointForm(false); setEditingCheckpointId(null); setCheckpointForm(emptyCheckpoint); setInitialCheckpointForm(emptyCheckpoint); }
  function startCheckpoint(checkpoint?: RoadCheckpoint) {
    const next = checkpoint ? checkpointFormFor(checkpoint) : emptyCheckpoint;
    setEditingCheckpointId(checkpoint?.id ?? null); setCheckpointForm(next); setInitialCheckpointForm(next); setShowCheckpointForm(true); setFeedback("");
  }
  function updateCheckpoint<K extends keyof CheckpointForm>(key: K, value: CheckpointForm[K]) { setCheckpointForm((current) => ({ ...current, [key]: value })); }

  function toggleVehicle(vehicleId: string) {
    setSelectedVehicleIds((current) => current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]);
    if (selectedVehicleIds.includes(vehicleId)) setHorseAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, assignedVehicle]) => assignedVehicle !== vehicleId)));
  }

  async function runMutation(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setFeedback("");
    try { await action(); await readBack(); setFeedback(success); return true; }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : "ROAD setup couldn't be updated.");
      if (caught instanceof CoordinatorWorkspaceError && ["LOCKED", "STALE_STATE", "VALIDATION_FAILED"].includes(caught.code)) {
        try { await readBack(); } catch { /* keep mutation error */ }
      }
      return false;
    } finally { setBusy(false); }
  }

  async function saveAllocations() {
    await runMutation(() => service.saveRoadAllocations(orderId, leg.id, {
      selectedVehicleIds,
      horseAssignments: Object.entries(horseAssignments).filter(([, vehicleId]) => selectedVehicleIds.includes(vehicleId)).map(([orderHorseId, vehicleId]) => ({ orderHorseId, vehicleId })),
    }), "ROAD allocation saved.");
  }

  async function saveCheckpoint(event: FormEvent) {
    event.preventDefault();
    if (await runMutation(() => service.saveRoadCheckpoint(orderId, leg.id, checkpointInput(checkpointForm), editingCheckpointId ?? undefined), editingCheckpointId ? "Checkpoint updated." : "Checkpoint added.")) closeCheckpointForm();
  }

  async function deleteCheckpoint(checkpoint: RoadCheckpoint) {
    if (!window.confirm(`Delete checkpoint ${checkpoint.sequenceNo}: ${checkpoint.name}?`)) return;
    await runMutation(() => service.deleteRoadCheckpoint(orderId, leg.id, checkpoint.id), "Checkpoint deleted.");
  }

  async function moveCheckpoint(checkpoint: RoadCheckpoint, direction: "UP" | "DOWN") { await runMutation(() => service.moveRoadCheckpoint(orderId, leg.id, checkpoint.id, direction), `Checkpoint moved ${direction === "UP" ? "up" : "down"}.`); }
  async function validateSetup() {
    setBusy(true); setError(""); setFeedback(""); setValidationNotice(null);
    try {
      const result = await service.validateRoadLegSetup(orderId, leg.id);
      setSetup(result);
      hydrateDraft(result);
      setValidationNotice(result.validationIssues.length === 0
        ? { kind: "success", title: "ROAD leg is ready", message: "Vehicle allocation and checkpoints passed the saved ROAD setup check.", issueCount: 0 }
        : { kind: "attention", title: "ROAD leg needs attention", message: "Review the highlighted items before checking this ROAD leg again.", issueCount: result.validationIssues.length });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The ROAD setup couldn't be checked.");
      try { await readBack(); } catch { /* retain validation error */ }
    } finally { setBusy(false); }
  }

  if (loading) return <div className="road-setup road-setup-loading" role="status" aria-label="Loading ROAD setup"><span /><span /></div>;
  if (!setup) return <div className="road-setup road-setup-unavailable" role="alert"><strong>ROAD setup unavailable</strong><p>{error}</p><div><button className="customer-secondary-button" type="button" onClick={safeClose}>Close</button><button className="customer-primary-button" type="button" onClick={() => void load()}>Try again</button></div></div>;

  return (
    <div className="road-setup">
      <header className="road-setup-heading">
        <div><h3>ROAD setup</h3><p>Leg {leg.sequenceNo} · {leg.origin} → {leg.destination}</p></div>
        <div className="road-setup-summary"><span>{selectedVehicleIds.length} vehicles selected</span><span className={assignedCount === setup.horses.length && setup.horses.length > 0 ? "is-complete" : ""}>{assignedCount}/{setup.horses.length} allocated</span><button type="button" aria-label="Close ROAD setup" onClick={safeClose}>×</button></div>
      </header>

      <div className="road-setup-tabs" role="tablist" aria-label="ROAD setup sections">
        <button role="tab" aria-selected={tab === "allocations"} type="button" onClick={() => switchTab("allocations")}>Vehicles &amp; Horses</button>
        <button role="tab" aria-selected={tab === "checkpoints"} type="button" onClick={() => switchTab("checkpoints")}>Checkpoints <span>{setup.checkpoints.length}</span></button>
      </div>

      {setup.readOnly || readOnly ? <p className="road-setup-readonly" role="status">Saved ROAD setup · Read-only</p> : null}
      {error && <div className="road-setup-message is-error" role="alert"><span>{error}</span><button type="button" onClick={() => void readBack()}>Refresh</button></div>}
      {feedback && <p className="road-setup-message is-success" role="status">{feedback}</p>}
      {setup.validationIssues.length > 0 && <section className="road-setup-validation" aria-labelledby={`road-validation-${leg.id}`}><div><span aria-hidden="true">!</span><div><h4 id={`road-validation-${leg.id}`}>Fix these ROAD leg issues</h4><p>Resolve each item before the final route check.</p></div><strong>{setup.validationIssues.length}</strong></div><ul className="road-setup-issues">{setup.validationIssues.map((issue, index) => <li key={`${issue.code}-${issue.targetId}-${index}`}><span aria-hidden="true">{index + 1}</span><div><strong>{issue.code.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase())}</strong><p>{issue.message}</p></div></li>)}</ul></section>}

      {tab === "allocations" ? (
        <div className="road-allocation-grid">
          <section aria-labelledby={`road-vehicles-${leg.id}`}>
            <div className="road-section-heading"><h4 id={`road-vehicles-${leg.id}`}>Vehicle candidates</h4><span>{setup.candidates.filter((candidate) => candidate.selectable).length} available</span></div>
            {setup.candidates.length > 0 && <label className="road-vehicle-search"><span className="sr-only">Search Vehicle candidates</span><input type="search" autoComplete="off" value={vehicleQuery} onChange={(event) => setVehicleQuery(event.target.value)} placeholder="Search plate, name or type" /></label>}
            {setup.candidates.length === 0 ? <div className="road-simple-empty"><strong>No Vehicle candidates</strong><p>Refresh when candidate results are available.</p></div> : (
              visibleCandidates.length === 0 ? <div className="road-simple-empty road-filter-empty"><strong>No matching Vehicles</strong><p>Try another plate, name or type.</p><button type="button" onClick={() => setVehicleQuery("")}>Clear search</button></div> : <div className="road-table-scroll road-vehicle-scroll"><table className="road-setup-table road-vehicle-table"><thead><tr><th scope="col">Select</th><th scope="col">Vehicle</th><th scope="col">Capacity</th><th scope="col">Status</th></tr></thead><tbody>{visibleCandidates.map((candidate) => {
                const checked = selectedVehicleIds.includes(candidate.id);
                return <tr key={candidate.id} className={!candidate.selectable ? "is-unavailable" : checked ? "is-selected" : undefined}><td><input aria-label={`Select ${candidate.plateNumber}`} type="checkbox" checked={checked} disabled={setup.readOnly || readOnly || busy || !candidate.selectable} onChange={() => toggleVehicle(candidate.id)} /></td><td><strong>{candidate.plateNumber}</strong><small>{candidate.vehicleName} · {candidate.vehicleType}</small></td><td>{candidate.horseCapacity} horses</td><td><span className={candidate.selectable ? "road-status is-available" : "road-status is-unavailable"}>{candidate.selectable ? "Available" : "Unavailable"}</span>{candidate.unavailableReason && <small className="road-unavailable-reason" title={candidate.unavailableReason}>{candidate.unavailableReason}</small>}</td></tr>;
              })}</tbody></table></div>
            )}
          </section>

          <section aria-labelledby={`road-horses-${leg.id}`}>
            <div className="road-section-heading"><h4 id={`road-horses-${leg.id}`}>Horses</h4><span className={assignedCount === setup.horses.length && setup.horses.length > 0 ? "is-complete" : ""}>{assignedCount}/{setup.horses.length} allocated</span></div>
            {setup.horses.length === 0 ? <div className="road-simple-empty"><strong>No Horses found</strong><p>The Order Horse list is unavailable.</p></div> : (
              <div className="road-table-scroll road-horse-scroll"><table className="road-setup-table road-horse-table"><thead><tr><th scope="col">Horse</th><th scope="col">Vehicle</th><th scope="col">Capacity</th></tr></thead><tbody>{setup.horses.map((horse) => {
                const vehicleId = horseAssignments[horse.orderHorseId] ?? "";
                const vehicle = setup.candidates.find((candidate) => candidate.id === vehicleId);
                const usedCapacity = vehicle ? capacityUse[vehicle.id] ?? 0 : 0;
                return <tr key={horse.orderHorseId} className={vehicle ? undefined : "is-unassigned"}><td data-label="Horse"><div className="road-horse-identity"><span aria-hidden="true">H</span><div><strong>{horse.name}</strong><small>Microchip: {horse.microchipId}{horse.travelNotes ? ` · ${horse.travelNotes}` : ""}</small></div></div></td><td data-label="Vehicle"><select aria-label={`Vehicle for ${horse.name}`} value={vehicleId} disabled={setup.readOnly || readOnly || busy} onChange={(event) => setHorseAssignments((current) => ({ ...current, [horse.orderHorseId]: event.target.value }))}><option value="">Select Vehicle</option>{setup.candidates.filter((candidate) => selectedVehicleIds.includes(candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.plateNumber} · {candidate.vehicleName}</option>)}</select></td><td data-label="Capacity"><span className={`road-capacity-badge${vehicle && usedCapacity > vehicle.horseCapacity ? " is-over" : ""}`}>{vehicle ? `${usedCapacity}/${vehicle.horseCapacity}` : "Unassigned"}</span></td></tr>;
              })}</tbody></table></div>
            )}
          </section>
        </div>
      ) : (
        <section className="road-checkpoints" aria-labelledby={`road-checkpoints-${leg.id}`}>
          <div className="road-section-heading"><div><h4 id={`road-checkpoints-${leg.id}`}>Ordered checkpoints</h4><p>Shared by all Vehicles on this ROAD leg.</p></div>{!setup.readOnly && !readOnly && !showCheckpointForm && <button className="customer-secondary-button" type="button" onClick={() => startCheckpoint()}>+ Add checkpoint</button>}</div>
          {setup.checkpoints.length === 0 ? <div className="road-simple-empty"><strong>No checkpoints yet</strong><p>Add a checkpoint when this leg requires a planned stop.</p></div> : <div className="road-table-scroll"><table className="road-setup-table"><thead><tr><th scope="col">#</th><th scope="col">Checkpoint</th><th scope="col">Type</th><th scope="col">Stop</th>{!setup.readOnly && !readOnly && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{setup.checkpoints.map((checkpoint, index) => <tr key={checkpoint.id}><td>{checkpoint.sequenceNo}</td><td><strong>{checkpoint.name}</strong><small>{checkpoint.countryCode || "No country"}{checkpoint.notes ? ` · ${checkpoint.notes}` : ""}</small></td><td>{checkpoint.checkpointType.replaceAll("_", " ")}</td><td>{checkpoint.checkpointType === "REST_STOP" ? `${checkpoint.plannedStopDurationMinutes ?? 0} min (min ${checkpoint.minimumRequiredStopMinutes ?? 0})` : "—"}</td>{!setup.readOnly && !readOnly && <td><div className="road-row-actions"><button type="button" aria-label={`Move ${checkpoint.name} up`} disabled={busy || index === 0} onClick={() => void moveCheckpoint(checkpoint, "UP")}>↑</button><button type="button" aria-label={`Move ${checkpoint.name} down`} disabled={busy || index === setup.checkpoints.length - 1} onClick={() => void moveCheckpoint(checkpoint, "DOWN")}>↓</button><button type="button" onClick={() => startCheckpoint(checkpoint)}>Edit</button><button className="is-danger" type="button" onClick={() => void deleteCheckpoint(checkpoint)}>Delete</button></div></td>}</tr>)}</tbody></table></div>}

          {showCheckpointForm && !setup.readOnly && !readOnly && <form className="road-checkpoint-form" onSubmit={(event) => void saveCheckpoint(event)}><div className="road-checkpoint-form-heading"><h5>{editingCheckpointId ? "Edit checkpoint" : "New checkpoint"}</h5><button type="button" aria-label="Close checkpoint editor" onClick={() => { if (!checkpointDirty || window.confirm("Discard checkpoint changes?")) closeCheckpointForm(); }}>×</button></div><div className="road-checkpoint-fields"><label>Name<input required value={checkpointForm.name} onChange={(event) => updateCheckpoint("name", event.target.value)} /></label><label>Type<select value={checkpointForm.checkpointType} onChange={(event) => updateCheckpoint("checkpointType", event.target.value as RoadCheckpointType)}><option value="REST_STOP">REST STOP</option><option value="BORDER">BORDER</option><option value="QUARANTINE">QUARANTINE</option><option value="OTHER">OTHER</option></select></label><label>Country code<input maxLength={10} value={checkpointForm.countryCode} onChange={(event) => updateCheckpoint("countryCode", event.target.value)} /></label>{checkpointForm.checkpointType === "REST_STOP" && <><label>Required minimum (minutes)<input required min="0" type="number" value={checkpointForm.minimumRequiredStopMinutes} onChange={(event) => updateCheckpoint("minimumRequiredStopMinutes", event.target.value)} /></label><label>Planned duration (minutes)<input required min="0" type="number" value={checkpointForm.plannedStopDurationMinutes} onChange={(event) => updateCheckpoint("plannedStopDurationMinutes", event.target.value)} /></label></>}<label className="is-wide">Notes <span>(optional)</span><textarea rows={2} value={checkpointForm.notes} onChange={(event) => updateCheckpoint("notes", event.target.value)} /></label></div><div className="road-checkpoint-form-actions"><button className="customer-secondary-button" type="button" onClick={closeCheckpointForm}>Cancel</button><button className="customer-primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save checkpoint"}</button></div></form>}
        </section>
      )}

      {!setup.readOnly && !readOnly && <footer className="road-setup-footer"><div><strong>{tab === "allocations" ? "Vehicle allocation" : "Checkpoint plan"}</strong><span>{dirty ? "Save or discard pending changes before checking." : "All changes are saved. You can check this ROAD leg."}</span></div><div><button className="customer-secondary-button" type="button" title={dirty ? "Save or discard pending changes before checking this ROAD leg." : undefined} disabled={busy || dirty} onClick={() => void validateSetup()}>{busy ? "Checking..." : "Check this ROAD leg"}</button>{tab === "allocations" && (allocationDirty ? <button className="customer-primary-button" type="button" disabled={busy} onClick={() => void saveAllocations()}>{busy ? "Saving..." : "Save allocations"}</button> : <span className="road-setup-saved-status" role="status"><span aria-hidden="true">&#10003;</span> Allocations saved</span>)}</div></footer>}
      {validationNotice && <ValidationResultDialog kind={validationNotice.kind} eyebrow="ROAD setup check" title={validationNotice.title} message={validationNotice.message} issueCount={validationNotice.issueCount} issues={setup.validationIssues.map((issue) => ({ label: issue.code.replaceAll("_", " ").toLowerCase().replace(/^./, (character) => character.toUpperCase()), message: issue.message }))} onClose={() => setValidationNotice(null)} />}
    </div>
  );
}
