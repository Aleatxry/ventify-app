interface VentilatorIconProps {
  size?: number;
}

export default function VentilatorIcon({ size = 28 }: VentilatorIconProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.88)}
      viewBox="0 0 100 88"
      fill="currentColor"
      style={{ color: "var(--v-text-2)", flexShrink: 0 }}
      aria-label="On ventilator"
    >
      {/* Trachea */}
      <rect x="45" y="0" width="10" height="24" rx="5" />
      {/* Left lobe */}
      <path d="M45 22 C38 18 24 20 15 30 C6 40 6 54 9 62 C12 70 20 74 28 71 C35 68 40 60 42 50 C44 42 45 32 45 22 Z" />
      {/* Right lobe */}
      <path d="M55 22 C62 18 76 20 85 30 C94 40 94 54 91 62 C88 70 80 74 72 71 C65 68 60 60 58 50 C56 42 55 32 55 22 Z" />
    </svg>
  );
}
