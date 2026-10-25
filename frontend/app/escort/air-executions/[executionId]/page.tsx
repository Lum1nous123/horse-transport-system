"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EscortWorkspaceFrame from "@/components/EscortWorkspaceFrame";
import ProofOfDeliveryForm from "@/components/ProofOfDeliveryForm";
import ProofOfDeliveryReadback from "@/components/ProofOfDeliveryReadback";
import WelfareEvidenceForm from "@/components/WelfareEvidenceForm";
import WelfareEvidenceReadback from "@/components/WelfareEvidenceReadback";
import { resolveAirExecutionAction } from "@/lib/escort-execution/air-action";
import {
  EscortExecutionError,
  getEscortExecutionService,
  type AssignedAirExecutionDetail,
  type ProofOfDeliveryInput,
  type RecordAirWelfareInput,
} from "@/lib/escort-execution/service";
import { useEscortAccess } from "@/lib/escort-execution/use-escort-access";

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

type MutationKey = "start" | "arrival" | "welfare" | "complete" | "proof-of-delivery";
type ReconciliationState = {
  message: string;
};

export default function AirExecutionDetailPage() {
  const params = useParams<{ executionId: string }>();
  const { state: accessState, preview, previewEscortId, previewEscortName, message: accessMessage, retryAccess } = useEscortAccess();
  const service = useMemo(() => getEscortExecutionService(preview), [preview]);
  const [execution, setExecution] = useState<AssignedAirExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<MutationKey | "">("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reconciliation, setReconciliation] = useState<ReconciliationState | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const mutationInFlight = useRef(false);
  const reconciliationRequired = useRef(false);
  const reconciliationInFlight = useRef(false);

  const loadExecution = useCallback(async (announce = false) => {
    setLoading(true);
    setError("");
    setErrorCode("");
    setFeedback("");
    try {
      const detail = await service.getAssignedAirExecution(params.executionId);
      setExecution(detail);
      reconciliationRequired.current = false;
      setReconciliation(null);
      if (announce) setFeedback("AIR execution refreshed from the saved service state.");
    } catch (caught) {
      setExecution(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this AIR execution.");
      setErrorCode(caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [params.executionId, service]);

  useEffect(() => {
    if (accessState !== "allowed") return;
    const timer = window.setTimeout(() => { void loadExecution(); }, 0);
    return () => window.clearTimeout(timer);
  }, [accessState, loadExecution]);

  function requireReconciliation(message: string) {
    reconciliationRequired.current = true;
    setError("");
    setErrorCode("");
    setFeedback("");
    setReconciliation({ message });
  }

  async function retryReconciliation() {
    if (reconciliationInFlight.current) return;
    reconciliationInFlight.current = true;
    setReconciling(true);
    try {
      const persisted = await service.getAssignedAirExecution(params.executionId);
      setExecution(persisted);
      reconciliationRequired.current = false;
      setReconciliation(null);
      setFeedback("Persisted AIR state confirmed. No mutation was sent again.");
    } catch (caught) {
      const readMessage = caught instanceof Error ? caught.message : "The persisted AIR state is still unavailable.";
      requireReconciliation(`Mutations remain locked because saved-state read-back failed again: ${readMessage}`);
    } finally {
      reconciliationInFlight.current = false;
      setReconciling(false);
    }
  }

  async function mutate(key: MutationKey, action: () => Promise<unknown>, successMessage: string) {
    if (mutationInFlight.current || reconciliationRequired.current) {
      throw new EscortExecutionError("An AIR execution update is already being saved.", "REQUEST_FAILED");
    }
    mutationInFlight.current = true;
    setBusyKey(key);
    setError("");
    setErrorCode("");
    setFeedback("");
    let writeSucceeded = false;
    try {
      await action();
      writeSucceeded = true;
      try {
        const persisted = await service.getAssignedAirExecution(params.executionId);
        setExecution(persisted);
        setFeedback(successMessage);
      } catch (caught) {
        const readMessage = caught instanceof Error ? caught.message : "The persisted AIR state could not be read back.";
        requireReconciliation(`The update was accepted, but its persisted result could not be confirmed: ${readMessage}`);
        throw caught;
      }
    } catch (caught) {
      if (writeSucceeded) throw caught;
      const nextMessage = caught instanceof Error ? caught.message : "We couldn't save this AIR execution update.";
      const nextCode = caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED";
      if (nextCode === "STALE_STATE") {
        try {
          setExecution(await service.getAssignedAirExecution(params.executionId));
          setFeedback("The AIR state changed and the latest persisted state was loaded. No mutation was replayed.");
        } catch (recoveryError) {
          const recoveryMessage = recoveryError instanceof Error ? recoveryError.message : "The latest persisted AIR state could not be loaded.";
          requireReconciliation(`The AIR state changed, and recovery read-back failed: ${recoveryMessage}`);
        }
      } else {
        setError(nextMessage);
        setErrorCode(nextCode);
      }
      throw caught;
    } finally {
      mutationInFlight.current = false;
      setBusyKey("");
    }
  }

  function recordWelfare(photo: File, note: string) {
    const input: RecordAirWelfareInput = { photo, note };
    return mutate(
      "welfare",
      () => service.recordAirWelfare(params.executionId, input),
      "AIR destination welfare saved and read back from the service state.",
    );
  }

  function recordProofOfDelivery(input: ProofOfDeliveryInput) {
    if (!execution) return Promise.reject(new EscortExecutionError("The AIR execution is unavailable.", "STALE_STATE"));
    return mutate(
      "proof-of-delivery",
      () => service.recordAirProofOfDelivery(execution.routeLegId, input),
      "Proof of Delivery saved and final delivery state read back from the service.",
    );
  }

  if (accessState === "checking") {
    return <main className="customer-page assignment-access-state"><p role="status">Checking Escort access...</p></main>;
  }

  if (accessState === "forbidden" || accessState === "failed") {
    return (
      <main className="customer-page assignment-access-state">
        <section className="assignment-access-card" role="alert">
          <p className="customer-eyebrow">WORKSPACE UNAVAILABLE</p>
          <h1>{accessState === "forbidden" ? "Access denied" : "We couldn't verify access"}</h1>
          <p>{accessMessage}</p>
          <div>
            {accessState === "failed" && <button className="customer-primary-button" type="button" onClick={retryAccess}>Try again</button>}
            <Link className="customer-secondary-button" href="/login">Return to sign in</Link>
          </div>
        </section>
      </main>
    );
  }

  const previewSuffix = preview ? `?preview=1&escortId=${encodeURIComponent(previewEscortId)}` : "";
  const queueHref = `/escort${previewSuffix}`;
  const busy = Boolean(busyKey) || Boolean(reconciliation) || reconciling;
  const nextAction = execution ? resolveAirExecutionAction(execution) : { kind: "NONE" as const };

  return (
    <EscortWorkspaceFrame preview={preview} previewEscortId={previewEscortId} previewEscortName={previewEscortName}>
      <nav className="escort-breadcrumb" aria-label="Breadcrumb">
        <Link href={queueHref}>Assigned journey work</Link><span aria-hidden="true">/</span><span aria-current="page">{execution?.orderCode ?? "AIR execution"}</span>
      </nav>

      {loading ? (
        <div className="escort-detail-skeleton" role="status" aria-label="Loading AIR execution"><span /><span /><span /></div>
      ) : !execution ? (
        <section className="escort-unavailable" role="alert">
          <p className="customer-eyebrow">EXECUTION UNAVAILABLE</p>
          <h1>{errorCode === "FORBIDDEN" ? "This AIR RouteLeg isn't assigned to you" : errorCode === "STALE_STATE" ? "The execution state changed" : "We couldn't open this AIR execution"}</h1>
          <p>{error}</p>
          <div><Link className="customer-primary-button" href={queueHref}>Back to assigned work</Link>{errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadExecution()}>Try again</button>}</div>
        </section>
      ) : (
        <>
          <header className="escort-detail-heading">
            <div>
              <span>{execution.orderCode} · AIR RouteLeg {execution.routeLegSequenceNo}</span>
              <h1>{execution.origin} <small>to {execution.destination}</small></h1>
              <p>{execution.isFinalLeg ? "Final AIR leg · PoD handover follows welfare" : "Connecting AIR leg"}</p>
            </div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to queue</Link><button className="customer-secondary-button" type="button" disabled={loading || busy} onClick={() => void loadExecution(true)}>Refresh</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" disabled={loading || busy} onClick={() => void loadExecution(true)}>Refresh saved state</button></div>}
          {reconciliation && <div className="customer-alert escort-reconciliation-alert" role="alert"><span>{reconciliation.message} The original mutation will not be sent again.</span><button type="button" disabled={reconciling} onClick={() => void retryReconciliation()}>{reconciling ? "Reading saved state..." : "Retry saved-state read-back"}</button></div>}

          <dl className="escort-execution-facts">
            <div><dt>Execution status</dt><dd><span className={`escort-status is-${execution.status.toLowerCase()}`}>{label(execution.status)}</span></dd></div>
            <div><dt>RouteLeg status</dt><dd>{label(execution.routeLegStatus)}</dd></div>
            <div><dt>Assigned Escort</dt><dd>{execution.assignedEscortName}</dd></div>
            <div><dt>Planned departure</dt><dd>{formatDateTime(execution.plannedDepartureAt)}</dd></div>
            <div><dt>Planned arrival</dt><dd>{formatDateTime(execution.plannedArrivalAt)}</dd></div>
            <div><dt>Last saved state</dt><dd>{formatDateTime(execution.lastUpdatedAt)}</dd></div>
            {execution.isFinalLeg && <div><dt>Order status</dt><dd>{label(execution.handoverProgress.orderStatus)}</dd></div>}
          </dl>

          <section className="escort-air-progress" aria-labelledby="air-progress-title">
            <div className="escort-section-heading"><div><span>AIR lifecycle</span><h2 id="air-progress-title">Execution progress</h2><p>Each action is enabled by persisted service capabilities, not inferred by the page.</p></div><strong>{execution.isFinalLeg ? "Final leg" : "Non-final leg"}</strong></div>
            <ol>
              <li className={execution.startedAt ? "is-complete" : nextAction.kind === "START" ? "is-current" : "is-pending"}><span aria-hidden="true">1</span><div><strong>Start AIR execution</strong><small>{execution.startedAt ? formatDateTime(execution.startedAt) : nextAction.kind === "START" ? "Ready to start" : "Waiting for RouteLeg readiness"}</small></div></li>
              <li className={execution.destinationArrivedAt ? "is-complete" : nextAction.kind === "ARRIVE_AT_DESTINATION" ? "is-current" : "is-pending"}><span aria-hidden="true">2</span><div><strong>Destination arrival</strong><small>{execution.destinationArrivedAt ? formatDateTime(execution.destinationArrivedAt) : nextAction.kind === "ARRIVE_AT_DESTINATION" ? "Ready to record" : "Available after start"}</small></div></li>
              <li className={execution.welfareEvidence ? "is-complete" : nextAction.kind === "RECORD_WELFARE" ? "is-current" : "is-pending"}><span aria-hidden="true">3</span><div><strong>Destination welfare</strong><small>{execution.welfareEvidence ? "Evidence saved" : nextAction.kind === "RECORD_WELFARE" ? "Photo and note required" : "Available after destination arrival"}</small></div></li>
              <li className={execution.status === "COMPLETED" ? "is-complete" : nextAction.kind === "COMPLETE" || nextAction.kind === "AWAITING_POD" ? "is-current" : "is-pending"}><span aria-hidden="true">4</span><div><strong>{execution.isFinalLeg ? "Proof of Delivery handover" : "Complete AIR execution"}</strong><small>{execution.proofOfDelivery ? `${execution.handoverProgress.completedHandovers}/${execution.handoverProgress.requiredHandovers} handover confirmed` : execution.status === "COMPLETED" ? formatDateTime(execution.completedAt) : nextAction.kind === "AWAITING_POD" ? "Awaiting PoD" : nextAction.kind === "COMPLETE" ? "Ready to complete" : "Available after welfare"}</small></div></li>
            </ol>
          </section>

          <section className="escort-air-action" aria-labelledby="air-action-title">
            <div className="escort-section-heading"><div><span>Available action</span><h2 id="air-action-title">Next AIR step</h2><p>Only one update can be submitted at a time. Every successful update is read back from the service.</p></div></div>
            {reconciliation ? (
              <p className="escort-locked-note">AIR mutations are locked until saved-state read-back succeeds.</p>
            ) : nextAction.kind === "INVALID" ? (
              <div className="customer-alert" role="alert"><span>{nextAction.message}</span><button type="button" disabled={loading || busy} onClick={() => void loadExecution(true)}>Refresh saved state</button></div>
            ) : nextAction.kind === "START" ? (
              <button className="customer-primary-button" type="button" disabled={busy} onClick={() => void mutate("start", () => service.startAirExecution(params.executionId), "AIR execution started and read back from the service state.").catch(() => undefined)}>{busyKey === "start" ? "Starting and reading back..." : "Start AIR execution"}</button>
            ) : nextAction.kind === "ARRIVE_AT_DESTINATION" ? (
              <button className="customer-primary-button" type="button" disabled={busy} onClick={() => void mutate("arrival", () => service.recordAirDestinationArrival(params.executionId), "Destination arrival saved and read back from the service state.").catch(() => undefined)}>{busyKey === "arrival" ? "Saving and reading back..." : "Record destination arrival"}</button>
            ) : nextAction.kind === "RECORD_WELFARE" ? (
              <WelfareEvidenceForm formId="air-destination-welfare" contextLabel={`${execution.orderCode} AIR destination`} title="Record AIR destination welfare" description="Attach one welfare photo and a meaningful note after destination arrival." busy={busy} submitLabel="Save AIR welfare" onSubmit={recordWelfare} />
            ) : nextAction.kind === "COMPLETE" ? (
              <button className="customer-primary-button" type="button" disabled={busy} onClick={() => void mutate("complete", () => service.completeAirExecution(params.executionId), "AIR execution completed and the persisted RouteLeg state was read back.").catch(() => undefined)}>{busyKey === "complete" ? "Completing and reading back..." : "Complete AIR execution"}</button>
            ) : execution.proofOfDelivery ? (
              <ProofOfDeliveryReadback proof={execution.proofOfDelivery} progress={execution.handoverProgress} />
            ) : nextAction.kind === "AWAITING_POD" && execution.proofOfDeliveryAvailable ? (
              <ProofOfDeliveryForm
                formId="air-proof-of-delivery"
                contextLabel={`${execution.orderCode} final AIR RouteLeg`}
                busy={busy}
                onSubmit={recordProofOfDelivery}
              />
            ) : nextAction.kind === "AWAITING_POD" ? (
              <div className="escort-air-handover" role="status"><strong>Proof of Delivery unavailable</strong><p>Refresh the persisted state before confirming this final AIR handover.</p></div>
            ) : execution.status === "COMPLETED" ? (
              <div className="escort-air-handover is-complete" role="status"><strong>AIR execution completed</strong><p>This non-final RouteLeg is complete. Any next-leg readiness is owned by the persisted service state.</p></div>
            ) : (
              <p className="escort-locked-note">No AIR action is currently available. Refresh after the preceding RouteLeg transition is persisted.</p>
            )}
          </section>

          {execution.welfareEvidence && (
            <section className="escort-final-welfare is-ready" aria-labelledby="air-welfare-title">
              <div className="escort-section-heading"><div><span>Saved evidence</span><h2 id="air-welfare-title">AIR destination welfare</h2><p>This read-back reflects the current service state.</p></div></div>
              <WelfareEvidenceReadback evidence={execution.welfareEvidence} />
            </section>
          )}
        </>
      )}
    </EscortWorkspaceFrame>
  );
}
