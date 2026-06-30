interface LungIconProps {
  size?: number;
  color?: string;
}

export default function LungIcon({ size = 18, color = "#0071E3" }: LungIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="On ventilator"
    >
      {/* Left lung */}
      <path
        d="M11 4C11 4 11 7 9 9C7 11 5 11 5 14C5 17 7 20 9 20C11 20 11 17 11 17V4Z"
        fill={color}
        opacity="0.85"
      />
      {/* Right lung */}
      <path
        d="M13 4C13 4 13 7 15 9C17 11 19 11 19 14C19 17 17 20 15 20C13 20 13 17 13 17V4Z"
        fill={color}
        opacity="0.85"
      />
      {/* Trachea */}
      <rect x="11" y="2" width="2" height="16" rx="1" fill={color} />
    </svg>
  );
}
