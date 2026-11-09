/* Decorative, original SVG artwork. No route or planning data is represented here. */
function Landscape() {
  return <>
    <path d="M8 197C66 108 114 122 178 157S302 73 378 92s112 53 167 51 84 21 105 54Z" fill="#dcecff" />
    <path d="M50 197c79-55 124-27 174-36s92-69 150-48 94 60 156 48 87 15 113 36Z" fill="#cce3fc" />
    <path d="M20 197c129-13 169 7 290-2s233-6 337 2" fill="none" stroke="#b5d7f8" strokeWidth="3" />
    <g fill="#d4e7fc"><path d="M85 63c0-14 21-18 28-8 11-5 25 2 24 12H78c0-5 3-7 7-4Z" /><path d="M555 57c4-20 28-20 33-6 12-3 23 3 24 14h-70c0-7 5-10 13-8Z" /></g>
    <g fill="none" stroke="#8ebee9" strokeWidth="4" strokeLinecap="round"><path d="M53 177h104m-91-10v30m35-30v30m35-30v30M488 179h127m-107-10v28m43-28v28m43-28v28" /></g>
    <g fill="#8dbce5"><ellipse cx="40" cy="183" rx="6" ry="15" transform="rotate(-35 40 183)" /><ellipse cx="53" cy="177" rx="6" ry="21" transform="rotate(-9 53 177)" /><ellipse cx="66" cy="184" rx="6" ry="15" transform="rotate(35 66 184)" /><ellipse cx="613" cy="182" rx="6" ry="20" transform="rotate(-35 613 182)" /><ellipse cx="628" cy="179" rx="7" ry="24" transform="rotate(10 628 179)" /><ellipse cx="640" cy="186" rx="6" ry="16" transform="rotate(40 640 186)" /></g>
  </>;
}

function Horse({ fill = "#3679b7" }: { fill?: string }) {
  return <path fill={fill} d="m0 58 8-18 19-5 13-10 10-19 8 6 3-12 6 16 13 9 7 19-6 7-15-7-7-7-3 20-2 30h-9l-3-26-17 1-7 25H8l4-30-6 14H0Z" />;
}

export function FleetPlanningIllustration() {
  return <svg className="frc-hero-art frc-planning-art" viewBox="0 0 660 215" fill="none" aria-hidden="true" focusable="false">
    <Landscape />
    <g transform="translate(442 112) scale(1.03)"><Horse /><path d="m41 25 9-18 9 7-2 9-9 16" fill="#24619c" /></g>
    <g transform="translate(273 87) rotate(6 96 56)">
      <rect width="191" height="111" rx="10" fill="#f6fbff" stroke="#5999d5" strokeWidth="3" />
      <rect x="7" y="7" width="177" height="97" rx="5" fill="#e1efff" stroke="#a8cdf1" />
      <path d="m8 79 39-21 43 16 41-31 52 15M43 8l20 33 47-14 39-19M75 102l-3-38M136 102l-8-23 29-16 26 24" stroke="#fff" strokeWidth="8" />
      <path d="M18 82c15-31 58-49 83-15s21-22 64-18" stroke="#3188e7" strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" />
    </g>
    <g transform="translate(178 106) rotate(-8 48 43)">
      <rect y="5" width="99" height="87" rx="9" fill="#f6fbff" stroke="#639fd7" strokeWidth="3" />
      <path d="M0 16a10 10 0 0 1 10-11h79a10 10 0 0 1 10 11v8H0Z" fill="#528fcb" />
      <g stroke="#b9d9f5" strokeWidth="4" strokeLinecap="round"><path d="M23 0v14M49 0v14M76 0v14" /></g>
      <g fill="#d5e8fc"><rect x="14" y="35" width="16" height="14" rx="3" /><rect x="41" y="35" width="16" height="14" rx="3" /><rect x="68" y="35" width="16" height="14" rx="3" /><rect x="14" y="60" width="16" height="14" rx="3" /><rect x="41" y="60" width="16" height="14" rx="3" /><rect x="68" y="60" width="16" height="14" rx="3" /></g>
      <path d="m71 41 4 4 7-9M17 66l4 4 7-9" stroke="#3788d7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g transform="translate(344 73)"><path d="M0 0c-14 0-13 16 0 30C13 16 14 0 0 0Z" fill="#2c86e1" /><circle cy="10" r="4.5" fill="white" /></g>
    <g transform="translate(423 121) scale(.8)"><path d="M0 0c-14 0-13 16 0 30C13 16 14 0 0 0Z" fill="#efa736" /><circle cy="10" r="4.5" fill="white" /></g>
  </svg>;
}

export function FleetTransportIllustration() {
  return <svg className="frc-hero-art frc-transport-art" viewBox="0 0 660 215" fill="none" aria-hidden="true" focusable="false">
    <Landscape />
    <path d="M161 85c54 26 80-40 141-19s53 36 106 0 59-14 75-16" stroke="#7ab4ef" strokeWidth="2" strokeDasharray="6 7" strokeLinecap="round" />
    <g fill="#b5d5f0"><circle cx="106" cy="137" r="18" /><circle cx="126" cy="125" r="19" /><circle cx="137" cy="144" r="16" /><circle cx="563" cy="139" r="17" /></g>
    <path d="M123 143v47m439-41v39" stroke="#99bfdf" strokeWidth="4" />
    <ellipse cx="346" cy="195" rx="141" ry="8" fill="#b6d7f6" opacity=".6" />
    <g stroke="#639bd0" strokeWidth="3" strokeLinejoin="round">
      <rect x="220" y="99" width="176" height="88" rx="7" fill="#eff7ff" />
      <path d="M396 125h49l32 32v30h-81Z" fill="#d4e7fa" />
      <path d="M409 133h31l21 23h-52Z" fill="#8bb9e0" stroke="#fff" />
      <path d="M220 177h257v12H220Z" fill="#a0c5e8" stroke="none" />
    </g>
    <g fill="#8db8df"><rect x="235" y="113" width="23" height="15" rx="2" /><rect x="266" y="113" width="23" height="15" rx="2" /><g transform="translate(312 127) scale(.51)"><Horse fill="#85b3dd" /></g></g>
    <g fill="#326894" stroke="#d2e6fa" strokeWidth="4"><circle cx="264" cy="188" r="13" /><circle cx="442" cy="188" r="13" /></g>
    <g fill="#b8d7ee"><circle cx="264" cy="188" r="4" /><circle cx="442" cy="188" r="4" /></g>
    <g transform="translate(470 44)"><path d="M0 0c-13 0-12 15 0 29C12 15 13 0 0 0Z" fill="#4d91cb" /><circle cy="9" r="4" fill="white" /></g>
  </svg>;
}

export function FleetSummaryIllustration({ kind }: { kind: "new" | "draft" | "returned" }) {
  return <svg viewBox="0 0 64 56" fill="none" aria-hidden="true" focusable="false">
    {kind === "new" ? <>
      <rect x="10" y="9" width="36" height="36" rx="5" fill="#b9dbff" stroke="#0864c5" strokeWidth="2" />
      <path d="M10 20h36M20 5v10M37 5v10m-19 16 4 4 7-9" stroke="#0864c5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="40" r="11" fill="#e5f3ff" stroke="#0864c5" strokeWidth="2" /><path d="m39 40 4 4 6-7" stroke="#0864c5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </> : kind === "draft" ? <>
      <path d="M15 7h23l8 8v28a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4Z" fill="#ffedc7" stroke="#a5650e" strokeWidth="2" />
      <path d="M20 17h15m-15 8h12m-12 8h9" stroke="#a5650e" strokeWidth="2" strokeLinecap="round" />
      <path d="m31 39 16-16 6 6-16 16-9 3Z" fill="#fff8eb" stroke="#a5650e" strokeWidth="2" strokeLinejoin="round" /><path d="m43 27 6 6m-18 6 6 6" stroke="#a5650e" strokeWidth="2" />
    </> : <>
      <path d="M42 10A20 20 0 0 0 9 31m-6-7 6 8 7-7" stroke="#8059db" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m24 27 15-7 15 7v18l-15 7-15-7Z" fill="#eee4ff" stroke="#8059db" strokeWidth="2" strokeLinejoin="round" /><path d="m24 27 15 7 15-7M39 34v18m-8-28 15 7v7" stroke="#8059db" strokeWidth="2" strokeLinejoin="round" />
    </>}
  </svg>;
}
