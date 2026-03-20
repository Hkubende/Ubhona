import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

type BackButtonProps = {
  label?: string;
  fallbackHref?: string;
  className?: string;
  showLabel?: boolean;
  iconOnly?: boolean;
};

export function BackButton({
  label = "Back",
  fallbackHref = "/",
  className,
  showLabel = true,
  iconOnly = false,
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = React.useCallback(() => {
    const stateIdx =
      typeof window !== "undefined" && typeof window.history?.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    const hasSameOriginReferrer =
      typeof document !== "undefined" &&
      !!document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    const canGoBack = stateIdx > 0 || (window.history.length > 1 && hasSameOriginReferrer);

    if (canGoBack) {
      navigate(-1);
      return;
    }

    navigate(fallbackHref || "/", { replace: true });
  }, [fallbackHref, navigate]);

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className={cn(
        "inline-flex min-h-11 items-center rounded-2xl border border-border bg-black/45 px-3 py-2 text-sm font-semibold text-text-primary shadow-subtle backdrop-blur transition duration-300 ease-out active:scale-[0.985] hover:border-primary/60 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55",
        iconOnly ? "w-11 justify-center px-0" : "gap-2",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {showLabel && !iconOnly ? <span className="leading-none">{label}</span> : null}
    </button>
  );
}
