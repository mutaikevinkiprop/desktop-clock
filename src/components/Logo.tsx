/**
 * Logo - the Desktop Clock application mark.
 *
 * A self-contained inline SVG (dark rounded panel, accent ring, clock hands)
 * so it renders instantly, scales crisply and needs no network request. The
 * accent gradient uses the app's UI accent colour so the mark always matches
 * the settings theme.
 */

interface LogoProps {
  size?: number;
  className?: string;
  /** Unique suffix so multiple logos on one page don't clash on gradient ids. */
  idSuffix?: string;
}

export default function Logo({ size = 32, className, idSuffix = "logo" }: LogoProps) {
  const panelId = `${idSuffix}-panel`;
  const ringId = `${idSuffix}-ring`;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Desktop Clock"
      focusable="false"
    >
      <defs>
        <linearGradient id={panelId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a202e" />
          <stop offset="1" stopColor="#0e1118" />
        </linearGradient>
        <linearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ui-accent, #5f8cff)" />
          <stop offset="1" stopColor="#8f6bff" />
        </linearGradient>
      </defs>

      <rect x="14" y="14" width="484" height="484" rx="120" fill={`url(#${panelId})`} />
      <circle
        cx="256"
        cy="256"
        r="152"
        fill="none"
        stroke={`url(#${ringId})`}
        strokeWidth="18"
      />
      <g stroke="#f5f7fa" strokeLinecap="round">
        <line x1="256" y1="256" x2="256" y2="148" strokeWidth="16" />
        <line x1="256" y1="256" x2="360" y2="256" strokeWidth="14" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#f5f7fa" />
    </svg>
  );
}