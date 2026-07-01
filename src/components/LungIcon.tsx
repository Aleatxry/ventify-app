import Image from "next/image";

interface LungIconProps {
  size?: number;
}

export default function LungIcon({ size = 18 }: LungIconProps) {
  return (
    <Image
      src="/lung-icon.png"
      alt="On ventilator"
      width={size}
      height={Math.round(size * 512 / 820)}
      style={{ objectFit: "contain" }}
    />
  );
}
