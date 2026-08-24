/**
 * Retrostat's mark, inlined so the extension build needs no remote image.
 * Source of truth: pratherbytecraft-site `public/brand/retrostat/retrostat.svg`
 * (variant D, 2026-08-25). Gradient ids are prefixed so several copies on one
 * page do not collide.
 */
interface RetrostatMarkProps {
  size?: number;
}

const RetrostatMark = ({ size = 40 }: RetrostatMarkProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    role="img"
    aria-label="Retrostat"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="rs-ring" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
        <stop offset="0%" stopColor="#9fa8ff" />
        <stop offset="55%" stopColor="#5865F2" />
        <stop offset="100%" stopColor="#4c46d6" />
      </linearGradient>
      <linearGradient id="rs-goop" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="100">
        <stop offset="0%" stopColor="#d4ff70" />
        <stop offset="55%" stopColor="#6cf25a" />
        <stop offset="100%" stopColor="#22b043" />
      </linearGradient>
      <clipPath id="rs-flask">
        <path d="M50 22 H70 V44 L92 86 A8 8 0 0 1 85 98 H35 A8 8 0 0 1 28 86 L50 44 Z" />
      </clipPath>
    </defs>
    <circle cx="60" cy="60" r="54" fill="#0b0e1a" stroke="url(#rs-ring)" strokeWidth="4" />
    <g clipPath="url(#rs-flask)">
      <path d="M20 74 C32 68 44 80 56 74 C68 68 80 80 100 74 V110 H20 Z" fill="url(#rs-goop)" />
      <circle cx="44" cy="90" r="2.8" fill="#0b0e1a" opacity=".45" />
      <circle cx="74" cy="84" r="2" fill="#0b0e1a" opacity=".4" />
    </g>
    <path
      d="M50 22 H70 V44 L92 86 A8 8 0 0 1 85 98 H35 A8 8 0 0 1 28 86 L50 44 Z"
      fill="none"
      stroke="url(#rs-ring)"
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path d="M45 22 H75" stroke="url(#rs-ring)" strokeWidth="5" strokeLinecap="round" />
    <path
      d="M71 40 C71 31 59 31 59 40 V78 C59 87 47 87 47 78"
      fill="none"
      stroke="#0b0e1a"
      strokeWidth="12"
      strokeLinecap="round"
    />
    <path
      d="M71 40 C71 31 59 31 59 40 V78 C59 87 47 87 47 78"
      fill="none"
      stroke="url(#rs-goop)"
      strokeWidth="6.5"
      strokeLinecap="round"
    />
  </svg>
);

export default RetrostatMark;
