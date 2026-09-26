import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { getAssetUrl } from "@/lib/assets";
import "./FeatureCard.css";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  link: string;
  bgImage: string;
  bgPosition?: string;
  bgScale?: number;
  bgOffsetX?: string;
  bgOffsetY?: string;
  ctaText: string;
}

/** GGArtifact's visual launcher layout with publisher wallpaper artwork. */
export function FeatureCard({
  icon,
  title,
  link,
  bgImage,
  bgPosition = "center center",
  bgScale = 1,
  bgOffsetX = "0%",
  bgOffsetY = "0%",
  ctaText,
}: FeatureCardProps) {
  return (
    <Link
      to={link}
      className="group relative flex min-h-[180px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[200px]"
    >
      <div className="absolute inset-y-0 right-0 z-0 w-[65%] overflow-hidden">
        <div
          style={
            {
              backgroundImage: `url('${getAssetUrl(bgImage)}')`,
              backgroundPosition: bgPosition,
              "--image-scale": bgScale,
              "--image-offset-x": bgOffsetX,
              "--image-offset-y": bgOffsetY,
            } as CSSProperties
          }
          className="home-card-image absolute inset-0 bg-cover transition-transform duration-700"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 30%, hsl(var(--card) / 0.5) 50%, transparent 75%)",
          }}
        />
      </div>
      <div className="relative z-10 flex h-full max-w-[70%] flex-1 flex-col gap-2 p-5 pb-16 sm:max-w-[55%]">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/20 p-2 text-primary shadow-lg shadow-primary/10 backdrop-blur-sm">
            {icon}
          </div>
          <h2 className="text-lg font-bold text-foreground md:text-2xl">
            {title}
          </h2>
        </div>
      </div>
      <span className="absolute bottom-4 right-5 z-10 inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-md shadow-primary/10 transition-shadow group-hover:shadow-lg group-hover:shadow-primary/20">
        {ctaText}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
