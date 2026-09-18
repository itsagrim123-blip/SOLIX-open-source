import Image from "next/image";

type SolixLogoSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<SolixLogoSize, number> = {
  sm: 26,
  md: 32,
  lg: 40,
};

interface SolixLogoProps {
  size?: SolixLogoSize;
  /** Override px dimension directly */
  px?: number;
  className?: string;
}

export function SolixLogo({ size = "sm", px, className = "" }: SolixLogoProps) {
  const dim = px ?? SIZE_MAP[size];

  return (
    <Image
      src="/solix-logo.jpg"
      alt="Solix"
      width={dim}
      height={dim}
      className={`rounded-[6px] object-cover flex-shrink-0 ${className}`}
      priority
    />
  );
}

