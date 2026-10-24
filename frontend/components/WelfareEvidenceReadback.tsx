import Image from "next/image";
import type { WelfareEvidence } from "@/lib/escort-execution/types";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WelfareEvidenceReadback({ evidence }: { evidence: WelfareEvidence }) {
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
        <strong>{evidence.photoIsPreview ? `Preview image from original file: ${evidence.photoName}` : evidence.photoName}</strong>
        <p>{evidence.note}</p>
        <time dateTime={evidence.recordedAt}>{formatDateTime(evidence.recordedAt)}</time>
      </div>
    </article>
  );
}
