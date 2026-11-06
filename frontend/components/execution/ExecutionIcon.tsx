import type { CSSProperties } from "react";

const paths = {
  truck: "M2 5h13v12H2z M15 9h4l3 4v4h-7 M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2z",
  signOut: "M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5 M16 7l5 5-5 5 M21 12H9",
  refresh: "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M18 17a7 7 0 0 1-12 1l-2-3",
  lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  back: "M20 12H4 M10 6l-6 6 6 6",
  check: "m5 12 4 4L19 6",
  flag: "M5 22V3 M5 3c5-4 9 4 15 0v10c-6 4-10-4-15 0",
} as const;

export default function ExecutionIcon({ name, className, style }: {
  name: keyof typeof paths; className?: string; style?: CSSProperties;
}) {
  return <svg className={className} style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
