import * as React from "react";
import { cn } from "../../lib/utils";
import { ImageThumbnail } from "./ImageThumbnail";

type DishCardProps = {
  name: string;
  description: string;
  imageUrl?: string;
  categoryLabel?: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export function DishCard({
  name,
  description,
  imageUrl,
  categoryLabel,
  status,
  actions,
  footer,
  active = false,
  onClick,
  className,
}: DishCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "ui-panel-inset cursor-pointer space-y-3 rounded-2xl p-4 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.04]",
        active && "border-primary/45 bg-primary/[0.09] shadow-[0_0_0_1px_rgba(255,106,26,0.12),0_10px_22px_rgba(60,24,12,0.14)]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <ImageThumbnail src={imageUrl || ""} name={name} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-text-primary">{name}</div>
          <p className="mt-1 text-xs leading-5 text-text-secondary/75">{description}</p>
          {(categoryLabel || status) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {categoryLabel ? (
                <span className="inline-flex rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-text-secondary">
                  {categoryLabel}
                </span>
              ) : null}
              {status}
            </div>
          )}
        </div>
        {actions ? <div onClick={(event) => event.stopPropagation()}>{actions}</div> : null}
      </div>
      {footer}
    </div>
  );
}
