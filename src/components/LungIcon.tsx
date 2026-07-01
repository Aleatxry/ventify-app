import Image from "next/image";

interface LungIconProps {
  size?: number;
}

export default function LungIcon({ size = 24 }: LungIconProps) {
  return (
    <Image
      src="/lung-icon.png"
      alt="On ventilator"
      width={size}
      height={Math.round(size * 656 / 766)}
      style={{ objectFit: "contain" }}
    />
  );
}
