/**
 * Scour's mark, inlined so the extension build needs no remote image.
 * Source of truth: pratherbytecraft-site `public/brand/scour/scour.svg`
 * (variant B5, 2026-08-27). Gradient ids are prefixed so several copies on
 * one page do not collide.
 */
interface ScourMarkProps {
  size?: number;
}

const ScourMark = ({ size = 40 }: ScourMarkProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 120 120"
    width={size}
    height={size}
    role="img"
    aria-label="Scour"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="sc-ring" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
        <stop offset="0%" stopColor="#9fa8ff" />
        <stop offset="55%" stopColor="#5865F2" />
        <stop offset="100%" stopColor="#4c46d6" />
      </linearGradient>
      <linearGradient id="sc-ice" gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="100" y2="100">
        <stop offset="0%" stopColor="#7ce8c4" />
        <stop offset="60%" stopColor="#5ea8ff" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <linearGradient id="sc-pink" gradientUnits="userSpaceOnUse" x1="60" y1="30" x2="100" y2="90">
        <stop offset="0%" stopColor="#ff7ad9" />
        <stop offset="100%" stopColor="#8b5cf6" />
      </linearGradient>
      <radialGradient id="sc-bubble" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0%" stopColor="#ffffff" stopOpacity=".6" />
        <stop offset="45%" stopColor="#9fa8ff" stopOpacity=".22" />
        <stop offset="100%" stopColor="#7ce8c4" stopOpacity=".1" />
      </radialGradient>
      <linearGradient id="sc-wipe" gradientUnits="userSpaceOnUse" x1="50" y1="0" x2="84" y2="0">
        <stop offset="0%" stopColor="#0b0e1a" />
        <stop offset="100%" stopColor="#0b0e1a" stopOpacity="0" />
      </linearGradient>
      <clipPath id="sc-face">
        <circle cx="60" cy="60" r="52" />
      </clipPath>
      <clipPath id="sc-ahead">
        <rect x="52" y="0" width="68" height="120" />
      </clipPath>
    </defs>
    <circle cx="60" cy="60" r="54" fill="#0b0e1a" stroke="url(#sc-ring)" strokeWidth="4" />
    <g clipPath="url(#sc-ahead)" fontFamily="Menlo, Consolas, monospace" fontSize="6" fill="#9fa8ff" opacity=".2">
      <text x="8" y="18" letterSpacing="1.5">011101001110111000</text>
      <text x="11" y="29" letterSpacing="1.5">100101000111110110</text>
      <text x="8" y="40" letterSpacing="1.5">001001100010011101</text>
      <text x="11" y="51" letterSpacing="1.5">000100100011010101</text>
      <text x="8" y="62" letterSpacing="1.5">111011101111100110</text>
      <text x="11" y="73" letterSpacing="1.5">101101011011000101</text>
      <text x="8" y="84" letterSpacing="1.5">100110011110010111</text>
      <text x="11" y="95" letterSpacing="1.5">010000000000100001</text>
      <text x="8" y="106" letterSpacing="1.5">000110000111000010</text>
    </g>
    <g clipPath="url(#sc-face)">
      <rect x="0" y="0" width="120" height="120" fill="url(#sc-wipe)" />
    </g>
    <path d="M30 40 L50 60 L30 80" fill="none" stroke="url(#sc-ice)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
    <path d="M48 40 L68 60 L48 80" fill="none" stroke="url(#sc-ice)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    <path d="M66 40 L86 60 L66 80" fill="none" stroke="url(#sc-ice)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="1" />
    {[
      'M72 38 l7 -3.5', 'M77 43 l7 -3.5', 'M82 48 l7 -3.5', 'M87 53 l7 -3.5', 'M92 58 l7 -3.5',
      'M92 62 l7 3.5', 'M87 67 l7 3.5', 'M82 72 l7 3.5', 'M77 77 l7 3.5', 'M72 82 l7 3.5',
    ].map((d) => (
      <path key={d} d={d} stroke="url(#sc-pink)" strokeWidth="3.5" strokeLinecap="round" />
    ))}
    {[
      { cx: 101, cy: 36, r: 5.5, sw: 0.88, hx: 98.9, hy: 33.9, hr: 1.3 },
      { cx: 104, cy: 62, r: 4.2, sw: 0.67, hx: 102.4, hy: 60.4, hr: 1.0 },
      { cx: 99, cy: 86, r: 5, sw: 0.8, hx: 97.1, hy: 84.1, hr: 1.2 },
      { cx: 93, cy: 50, r: 2, sw: 0.32, hx: 92.2, hy: 49.2, hr: 0.5 },
      { cx: 96, cy: 72, r: 1.8, sw: 0.29, hx: 95.3, hy: 71.3, hr: 0.4 },
      { cx: 90, cy: 30, r: 1.5, sw: 0.24, hx: 89.4, hy: 29.4, hr: 0.4 },
      { cx: 88, cy: 94, r: 1.6, sw: 0.26, hx: 87.4, hy: 93.4, hr: 0.4 },
    ].map((b) => (
      <g key={`${b.cx}-${b.cy}`}>
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="url(#sc-bubble)" stroke="#c9cfff" strokeWidth={b.sw} strokeOpacity=".85" />
        <circle cx={b.hx} cy={b.hy} r={b.hr} fill="#ffffff" opacity=".9" />
      </g>
    ))}
  </svg>
);

export default ScourMark;
