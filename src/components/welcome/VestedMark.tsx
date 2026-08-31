/**
 * Vested's mark, inlined so the extension build needs no remote image.
 * Source of truth: pratherbytecraft-site `public/brand/vested/vested.svg`
 * (variant DC1 "Sealed Medal", 2026-08-30). Gradient ids are prefixed so
 * several copies on one page do not collide.
 */
interface VestedMarkProps {
  size?: number;
}

const VestedMark = ({ size = 40 }: VestedMarkProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    role="img"
    aria-label="Vested"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="vs-ring" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
        <stop offset="0%" stopColor="#9fa8ff" />
        <stop offset="55%" stopColor="#5865F2" />
        <stop offset="100%" stopColor="#4c46d6" />
      </linearGradient>
      <linearGradient id="vs-gold" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="100" y2="105">
        <stop offset="0%" stopColor="#ffe3a0" />
        <stop offset="55%" stopColor="#f0b13e" />
        <stop offset="100%" stopColor="#c97f1f" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="54" fill="#0b0e1a" stroke="url(#vs-ring)" strokeWidth="4" />
    <path d="M48 10 L72 10 L72 38 L60 29 L48 38 Z" fill="url(#vs-ring)" />
    <circle cx="60" cy="66" r="26" fill="url(#vs-gold)" />
    <circle cx="40" cy="74" r="6" fill="url(#vs-gold)" />
    <circle cx="80" cy="56" r="5.5" fill="url(#vs-gold)" />
    <circle cx="72" cy="88" r="5" fill="url(#vs-gold)" />
    <circle cx="49" cy="46" r="4" fill="url(#vs-gold)" />
    <circle cx="60" cy="66" r="19.5" fill="none" stroke="#0b0e1a" strokeWidth="1.6" opacity=".35" />
    <path d="M52 57 H68 M52 75 H68" stroke="#0b0e1a" strokeWidth="3.4" strokeLinecap="round" />
    <path
      d="M54 58.5 C54 64 59 65 59 66 C59 67 54 68 54 73.5 M66 58.5 C66 64 61 65 61 66 C61 67 66 68 66 73.5"
      fill="none"
      stroke="#0b0e1a"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path d="M56.5 60 L63.5 60 L60 64 Z" fill="#0b0e1a" />
    <path d="M55.5 73.5 L64.5 73.5 L60 68.5 Z" fill="#0b0e1a" />
  </svg>
);

export default VestedMark;
