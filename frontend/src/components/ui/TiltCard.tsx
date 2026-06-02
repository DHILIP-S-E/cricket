import * as React from "react";
import { cn } from "../../lib/utils";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  maxTilt?: number;
  scaleOnHover?: number;
  showShine?: boolean;
}

export function TiltCard({
  children,
  className,
  maxTilt = 12,
  scaleOnHover = 1.03,
  showShine = true,
  style,
  ...props
}: TiltCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = React.useState({ rx: 0, ry: 0, tx: 0, ty: 0 });
  const [isHovered, setIsHovered] = React.useState(false);
  const [shinePos, setShinePos] = React.useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Mouse coordinates relative to card top-left
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Normalised position: -0.5 to 0.5
    const x = mouseX / width - 0.5;
    const y = mouseY / height - 0.5;

    // Rotation values: maxTilt maps to max tilt angle in degrees
    const rx = -y * maxTilt;
    const ry = x * maxTilt;

    // Translational offsets for interior elements
    const tx = x * 8;
    const ty = y * 8;

    setTilt({ rx, ry, tx, ty });
    setShinePos({ x: mouseX, y: mouseY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0, tx: 0, ty: 0 });
  };

  const cardStyle: React.CSSProperties = {
    ...style,
    transform: isHovered
      ? `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${scaleOnHover})`
      : "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)",
    transition: isHovered ? "transform 0.08s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease-out" : "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.4s ease-out",
    transformStyle: "preserve-3d",
    // Set custom CSS variables for nested parallax layers to reference
    ["--rx" as any]: `${tilt.rx}deg`,
    ["--ry" as any]: `${tilt.ry}deg`,
    ["--tx" as any]: `${tilt.tx}px`,
    ["--ty" as any]: `${tilt.ty}px`,
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      className={cn(
        "relative overflow-hidden rounded-xl border border-surface-border bg-surface-card text-gray-100 shadow-lg transition-shadow duration-300",
        isHovered && "shadow-2xl shadow-black/50 border-gray-700",
        className
      )}
      {...props}
    >
      {/* Dynamic Shine Layer */}
      {showShine && isHovered && (
        <div
          className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay opacity-35 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle 180px at ${shinePos.x}px ${shinePos.y}px, rgba(255, 255, 255, 0.4) 0%, transparent 80%)`,
          }}
        />
      )}
      {children}
    </div>
  );
}
