import styles from "./execution.module.css";

/** Decorative wayfinding artwork for the Driver dashboard only. */
export default function DriverDashboardDecor() {
  return <div className={styles.dashboardDecor} aria-hidden="true">
    <svg className={styles.roadDecor} viewBox="0 0 690 210" fill="none" focusable="false">
      <path d="M-20 191C121 90 189 133 322 94S548 126 711-30" stroke="currentColor" strokeWidth="72" opacity=".12" />
      <path d="M-20 191C121 90 189 133 322 94S548 126 711-30" stroke="currentColor" strokeWidth="1.5" opacity=".35" />
      <path d="M-20 157C121 56 189 99 322 60S548 92 711-64" stroke="currentColor" strokeWidth="1.5" opacity=".28" />
      <path d="M-20 191C121 90 189 133 322 94S548 126 711-30" stroke="#fff" strokeWidth="2" strokeDasharray="16 20" opacity=".9" />
      <path d="M357 42c0-9 13-9 13 0 0 5-6.5 13-6.5 13S357 47 357 42Z" fill="currentColor" opacity=".8" />
      <circle cx="363.5" cy="42" r="2" fill="white" />
    </svg>
    <svg className={styles.terrainDecor} viewBox="0 0 340 116" fill="none" focusable="false">
      <path d="M-19 61C34 12 67 31 108 54s75-20 120 9 71 2 127 30" />
      <path d="M-21 78C32 30 65 49 106 72s75-20 120 9 71 2 127 30" />
      <path d="M-23 95C30 47 63 66 104 89s75-20 120 9 71 2 127 30" />
    </svg>
    <svg className={styles.compassDecor} viewBox="0 0 56 72" fill="none" focusable="false">
      <text x="28" y="11" textAnchor="middle">N</text>
      <circle cx="28" cy="42" r="19" />
      <path d="m28 26 7 23-7-6-7 6 7-23Z" />
      <path d="m28 26-7 23 7-6V26Z" fill="currentColor" opacity=".18" stroke="none" />
    </svg>
  </div>;
}
