import Image from "next/image";

type SolixLogoSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<SolixLogoSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
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
      src="/solix-logo.png"
      alt="Solix"
      width={dim}
      height={dim}
      className={`object-contain flex-shrink-0 ${className}`}
      priority
    />
  );
}
