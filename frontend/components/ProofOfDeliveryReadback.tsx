import Image from "next/image";
import type { HandoverProgress, ProofOfDelivery } from "@/lib/escort-execution/types";

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

export default function ProofOfDeliveryReadback({
  proof,
  progress,
}: {
  proof: ProofOfDelivery;
  progress: HandoverProgress;
}) {
  return (
    <article className="escort-pod-readback">
      <Image
        src={proof.proofPhotoUrl}
        alt={`Proof of Delivery ${proof.proofPhotoName}`}
        width={180}
        height={126}
        unoptimized
      />
      <div>
        <span>Saved Proof of Delivery</span>
        <h3>{proof.recipientName}</h3>
        <p><strong>{proof.proofPhotoIsPreview ? "Preview image from original file" : "Photo"}:</strong> {proof.proofPhotoName}</p>
        {proof.handoverNote && <p><strong>Note:</strong> {proof.handoverNote}</p>}
        <dl>
          <div><dt>Handovers</dt><dd>{progress.completedHandovers}/{progress.requiredHandovers}</dd></div>
          <div><dt>RouteLeg</dt><dd>{label(progress.routeLegStatus)}</dd></div>
          <div><dt>Order</dt><dd>{label(progress.orderStatus)}</dd></div>
        </dl>
        <time dateTime={proof.deliveredAt}>{formatDateTime(proof.deliveredAt)}</time>
      </div>
    </article>
  );
}
