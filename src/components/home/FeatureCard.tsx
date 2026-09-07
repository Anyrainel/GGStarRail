import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AssetImage } from "@/components/shared/AssetImage";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  problem: string;
  guideline: string;
  link: string;
  characterId: string;
  ctaText: string;
  assetsReady: boolean;
}

/** GGArtifact's visual launcher layout, using the Star Rail asset cache. */
export function FeatureCard({
  icon,
  title,
  problem,
  guideline,
  link,
  characterId,
  ctaText,
  assetsReady,
}: FeatureCardProps) {
  return (
    <Link
      to={link}
      className="group relative flex min-h-[230px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card shadow-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[250px]"
    >
      <div className="absolute inset-y-0 right-0 z-0 w-[60%] max-w-[250px] overflow-hidden">
        {assetsReady && (
          <AssetImage
            kind="character"
            id={characterId}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card) / 0.8) 25%, hsl(var(--card) / 0.25) 65%, transparent 100%)",
          }}
        />
      </div>
      <div className="relative z-10 flex h-full max-w-[78%] flex-col gap-2 p-5 pb-16 sm:max-w-[65%]">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/20 p-2 text-primary shadow-lg shadow-primary/10 backdrop-blur-sm">
            {icon}
          </div>
          <span className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
            {title}
          </span>
        </div>
        <h2 className="text-lg font-bold leading-tight text-foreground md:text-2xl">
          {problem}
        </h2>
        <p className="text-sm leading-relaxed text-foreground/75">
          {guideline}
        </p>
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
