import type { ReactNode } from "react";

type IconName = "calendar" | "plane" | "truck" | "route" | "horse" | "user" | "signOut" | "refresh";

const paths: Record<IconName, ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2" /></>,
  plane: <><path d="m21 3-8.2 17-2.7-7.1L3 10.2 21 3Z" /><path d="m10.1 12.9 4.7-4.7" /></>,
  truck: <><path d="M2 6h12v11H2zM14 10h4l4 4v3h-8" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  route: <><circle cx="5" cy="17" r="2" /><circle cx="19" cy="7" r="2" /><path d="M7 17c5 0 3-10 10-10" /></>,
  horse: <><path d="M4 20v-5l3-4 1-5 4-2 2 3 3 1 3 5-3 2-3-2-2 2v5" /><path d="M8 6 5 4M13 9h.01M7 11l-3 1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" /></>,
  signOut: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="M8 12h13m-5-5 5 5-5 5" /></>,
  refresh: <><path d="M20 11a8 8 0 1 1-2.5-5.8" /><path d="M20 4v5h-5" /></>,
};

export default function TransportSpecialistIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
