interface LungIconProps {
  size?: number;
}

export default function LungIcon({ size = 24 }: LungIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Ventify"
    >
      <path
        d="M12 4C12 4 10 4 10 7V10C10 10 8 10 7 12C6 14 6 17 7 19C8 21 10 21 11 20C11.5 19.5 12 18 12 18C12 18 12.5 19.5 13 20C14 21 16 21 17 19C18 17 18 14 17 12C16 10 14 10 14 10V7C14 4 12 4 12 4Z"
        fill="currentColor"
        style={{ color: "var(--v-accent)" }}
      />
      <path
        d="M10 10V13M14 10V13"
        stroke="var(--v-bg)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
