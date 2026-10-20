"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EscortWorkspaceFrame from "@/components/EscortWorkspaceFrame";
import RoadWelfareForm from "@/components/RoadWelfareForm";
import {
  EscortExecutionError,
  getEscortExecutionService,
  type AssignedRoadExecutionDetail,
  type RecordRoadWelfareInput,
  type WelfareEvidence,
} from "@/lib/escort-execution/service";
import { useEscortAccess } from "@/lib/escort-execution/use-escort-access";

function formatDateTime(value: string) {
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

function WelfareReadback({ evidence }: { evidence: WelfareEvidence }) {
  return (
    <article className="escort-welfare-readback">
      <Image
        src={evidence.photoUrl}
        alt={`Welfare evidence ${evidence.photoName}`}
        width={160}
        height={110}
        unoptimized
      />
      <div>
        <span>Saved welfare evidence</span>
        <strong>{evidence.photoName}</strong>
        <p>{evidence.note}</p>
        <time dateTime={evidence.recordedAt}>{formatDateTime(evidence.recordedAt)}</time>
      </div>
    </article>
  );
}

export default function RoadExecutionDetailPage() {
  const params = useParams<{ executionId: string }>();
  const { state: accessState, preview, previewEscortId, previewEscortName, message: accessMessage, retryAccess } = useEscortAccess();
  const service = useMemo(() => getEscortExecutionService(preview), [preview]);
  const [execution, setExecution] = useState<AssignedRoadExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const mutationInFlight = useRef(false);

  const loadExecution = useCallback(async (announce = false) => {
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const detail = await service.getAssignedRoadExecution(params.executionId);
      setExecution(detail);
      if (announce) setFeedback("Execution state refreshed from the saved service state.");
    } catch (caught) {
      setExecution(null);
      setError(caught instanceof Error ? caught.message : "We couldn't load this ROAD execution.");
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

  async function recordWelfare(
    key: string,
    input: RecordRoadWelfareInput,
  ) {
    if (mutationInFlight.current) {
      throw new EscortExecutionError("A welfare update is already being saved.", "REQUEST_FAILED");
    }
    mutationInFlight.current = true;
    setBusyKey(key);
    setError("");
    setErrorCode("");
    setFeedback("");
    try {
      await service.recordRoadWelfare(params.executionId, input);
      const persisted = await service.getAssignedRoadExecution(params.executionId);
      setExecution(persisted);
      setFeedback(input.eventType === "CHECKPOINT"
        ? "Checkpoint welfare saved and read back from the service state."
        : "Final welfare saved and read back from the service state.");
    } catch (caught) {
      const nextMessage = caught instanceof Error ? caught.message : "We couldn't save this welfare update.";
      const nextCode = caught instanceof EscortExecutionError ? caught.code : "REQUEST_FAILED";
      if (nextCode === "STALE_STATE") {
        try {
          setExecution(await service.getAssignedRoadExecution(params.executionId));
        } catch {
          setExecution(null);
        }
      }
      setError(nextMessage);
      setErrorCode(nextCode);
      throw caught;
    } finally {
      mutationInFlight.current = false;
      setBusyKey("");
    }
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

  return (
    <EscortWorkspaceFrame preview={preview} previewEscortId={previewEscortId} previewEscortName={previewEscortName}>
      <nav className="escort-breadcrumb" aria-label="Breadcrumb">
        <Link href={queueHref}>Assigned journey work</Link><span aria-hidden="true">/</span><span aria-current="page">{execution?.vehiclePlateNumber ?? "ROAD execution"}</span>
      </nav>

      {loading ? (
        <div className="escort-detail-skeleton" role="status" aria-label="Loading ROAD execution"><span /><span /><span /></div>
      ) : !execution ? (
        <section className="escort-unavailable" role="alert">
          <p className="customer-eyebrow">EXECUTION UNAVAILABLE</p>
          <h1>{errorCode === "FORBIDDEN" ? "This Vehicle isn't assigned to you" : errorCode === "STALE_STATE" ? "The execution state changed" : "We couldn't open this execution"}</h1>
          <p>{error}</p>
          <div><Link className="customer-primary-button" href={queueHref}>Back to assigned work</Link>{errorCode === "REQUEST_FAILED" && <button className="customer-secondary-button" type="button" onClick={() => void loadExecution()}>Try again</button>}</div>
        </section>
      ) : (
        <>
          <header className="escort-detail-heading">
            <div>
              <span>{execution.orderCode} · RouteLeg {execution.routeLegSequenceNo}</span>
              <h1>{execution.vehiclePlateNumber} <small>{execution.vehicleName}</small></h1>
              <p>{execution.origin} <b aria-hidden="true">→</b> {execution.destination}</p>
            </div>
            <div><Link className="customer-secondary-button" href={queueHref}>Back to queue</Link><button className="customer-secondary-button" type="button" disabled={loading || Boolean(busyKey)} onClick={() => void loadExecution(true)}>Refresh</button></div>
          </header>

          {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
          {error && <div className="customer-alert" role="alert"><span>{error}</span><button type="button" disabled={loading || Boolean(busyKey)} onClick={() => void loadExecution(true)}>Refresh saved state</button></div>}

          <dl className="escort-execution-facts">
            <div><dt>Vehicle status</dt><dd><span className={`escort-status is-${execution.status.toLowerCase()}`}>{label(execution.status)}</span></dd></div>
            <div><dt>RouteLeg status</dt><dd>{label(execution.routeLegStatus)}</dd></div>
            <div><dt>Assigned Driver</dt><dd>{execution.driverName}</dd></div>
            <div><dt>Assigned Escort</dt><dd>{execution.assignedEscortName}</dd></div>
            <div><dt>Planned departure</dt><dd>{formatDateTime(execution.plannedDepartureAt)}</dd></div>
            <div><dt>Last saved state</dt><dd>{formatDateTime(execution.lastUpdatedAt)}</dd></div>
          </dl>

          <section className="escort-horses" aria-labelledby="escort-horses-title">
            <div className="escort-section-heading"><div><span>Vehicle scope</span><h2 id="escort-horses-title">Assigned Horses</h2></div><strong>{execution.horses.length}</strong></div>
            <div>{execution.horses.map((horse) => <article key={horse.id}><span aria-hidden="true">H</span><div><strong>{horse.name}</strong><small>Microchip {horse.microchipId}</small></div></article>)}</div>
          </section>

          <section className="escort-checkpoint-section" aria-labelledby="escort-checkpoints-title">
            <div className="escort-section-heading">
              <div><span>Shared RouteLeg plan</span><h2 id="escort-checkpoints-title">Checkpoint welfare</h2><p>Arrival and welfare remain Vehicle-specific even though the checkpoint definitions are shared.</p></div>
              <strong>{execution.checkpoints.length}</strong>
            </div>
            {execution.checkpoints.length === 0 ? (
              <div className="escort-no-checkpoints"><strong>No intermediate checkpoints</strong><p>This ROAD RouteLeg goes directly to destination.</p></div>
            ) : (
              <ol className="escort-checkpoint-list">
                {execution.checkpoints.map((checkpoint) => {
                  const canRecord = execution.availableActions.checkpointWelfareIds.includes(checkpoint.id);
                  return (
                    <li key={checkpoint.id} className={checkpoint.arrivedAt ? "is-reached" : "is-locked"}>
                      <div className="escort-checkpoint-marker" aria-hidden="true">{checkpoint.arrivedAt ? "✓" : checkpoint.sequenceNo}</div>
                      <article>
                        <header><div><span>Checkpoint {checkpoint.sequenceNo} · {label(checkpoint.checkpointType)}</span><h3>{checkpoint.name}</h3></div><strong>{checkpoint.arrivedAt ? `Reached ${formatDateTime(checkpoint.arrivedAt)}` : "Not reached"}</strong></header>
                        {checkpoint.welfareEvidence ? (
                          <WelfareReadback evidence={checkpoint.welfareEvidence} />
                        ) : canRecord ? (
                          <RoadWelfareForm
                            formId={`checkpoint-${checkpoint.id}`}
                            contextLabel={`${checkpoint.name} checkpoint`}
                            title="Record checkpoint welfare"
                            description={`Attach evidence for ${execution.vehiclePlateNumber} at this reached checkpoint.`}
                            busy={Boolean(busyKey)}
                            onSubmit={(photo, note) => recordWelfare(checkpoint.id, { eventType: "CHECKPOINT", checkpointId: checkpoint.id, photo, note })}
                          />
                        ) : (
                          <p className="escort-locked-note">Welfare becomes available only after this Vehicle reaches the checkpoint.</p>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className={`escort-final-welfare ${execution.destinationArrivedAt ? "is-ready" : "is-locked"}`} aria-labelledby="escort-final-title">
            <div className="escort-section-heading">
              <div><span>Destination boundary</span><h2 id="escort-final-title">Final welfare</h2><p>Final welfare is separate from Proof of Delivery. This task never completes the final RouteLeg or Order.</p></div>
              <strong>{execution.isFinalLeg ? "Final leg" : "Non-final leg"}</strong>
            </div>
            {execution.finalWelfareEvidence ? (
              <WelfareReadback evidence={execution.finalWelfareEvidence} />
            ) : execution.availableActions.finalWelfare ? (
              <RoadWelfareForm
                formId="final-welfare"
                contextLabel={`${execution.vehiclePlateNumber} final destination`}
                title="Record final destination welfare"
                description={`Driver arrival was saved ${formatDateTime(execution.destinationArrivedAt ?? "")}. Record the final welfare evidence for this Vehicle.`}
                busy={Boolean(busyKey)}
                submitLabel="Save final welfare"
                onSubmit={(photo, note) => recordWelfare("final", { eventType: "FINAL_DESTINATION", photo, note })}
              />
            ) : (
              <p className="escort-locked-note">The assigned Driver must record destination arrival before final welfare becomes available.</p>
            )}
          </section>
        </>
      )}
    </EscortWorkspaceFrame>
  );
}
