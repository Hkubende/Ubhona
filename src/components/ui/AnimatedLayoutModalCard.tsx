import * as React from "react";
import { createLayout } from "animejs";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { tokens, typography } from "../../design-system";
import { Button } from "./Button";
import { Avatar } from "./Avatar";

export type AnimatedLayoutModalCardStat = {
  label: string;
  value: React.ReactNode;
};

type AnimatedLayoutModalCardProps = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  stats?: AnimatedLayoutModalCardStat[];
  cta?: React.ReactNode;
  children?: React.ReactNode;
  duration?: number;
  className?: string;
  modalClassName?: string;
  ariaLabel?: string;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Premium card-to-native-dialog transition powered by Anime.js createLayout().
 * Use this for expandable dish, analytics, or demo cards. Pass `duration`
 * to tune motion; Escape/backdrop close the dialog and focus returns to the
 * original card trigger.
 */
export function AnimatedLayoutModalCard({
  id,
  title,
  subtitle,
  description,
  imageUrl,
  imageAlt,
  stats = [],
  cta,
  children,
  duration = 450,
  className,
  modalClassName,
  ariaLabel,
}: AnimatedLayoutModalCardProps) {
  const safeId = React.useId().replace(/:/g, "");
  const layoutId = `ubhona-layout-modal-${id || safeId}`;
  const titleId = `${layoutId}-title`;
  const descriptionId = description ? `${layoutId}-description` : undefined;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = React.useState(false);

  const closeModal = React.useCallback(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog?.open) return;

    const reducedMotion = prefersReducedMotion();
    const restoreFocus = () => {
      trigger?.focus({ preventScroll: true });
      window.setTimeout(() => trigger?.focus({ preventScroll: true }), 0);
    };
    const runClose = () => {
      dialog.close();
      trigger?.classList.remove("is-open");
      setOpen(false);
    };

    if (reducedMotion) {
      runClose();
      restoreFocus();
      return;
    }

    const layout = createLayout(dialog, {
      children: [
        `[data-layout-id="${layoutId}"]`,
        `[data-layout-id="${layoutId}-media"]`,
        `[data-layout-id="${layoutId}-title"]`,
        `[data-layout-id="${layoutId}-subtitle"]`,
        `[data-layout-id="${layoutId}-description"]`,
        `[data-layout-id="${layoutId}-stats"]`,
      ],
      properties: ["boxShadow", "--ubhona-layout-backdrop-alpha"],
    });

    layout.update(() => runClose(), {
      duration,
      ease: "inOut(3.5)",
      leaveTo: { opacity: 0 },
      onComplete: restoreFocus,
    });
    window.setTimeout(restoreFocus, duration + 80);
  }, [duration, layoutId]);

  const openModal = React.useCallback(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog || dialog.open) return;

    const reducedMotion = prefersReducedMotion();
    const runOpen = () => {
      dialog.showModal();
      trigger?.classList.add("is-open");
      setOpen(true);
    };

    if (reducedMotion) {
      runOpen();
      return;
    }

    const layout = createLayout(dialog, {
      children: [
        `[data-layout-id="${layoutId}"]`,
        `[data-layout-id="${layoutId}-media"]`,
        `[data-layout-id="${layoutId}-title"]`,
        `[data-layout-id="${layoutId}-subtitle"]`,
        `[data-layout-id="${layoutId}-description"]`,
        `[data-layout-id="${layoutId}-stats"]`,
      ],
      properties: ["boxShadow", "--ubhona-layout-backdrop-alpha"],
    });

    layout.update(() => runOpen(), {
      duration,
      ease: "inOut(3.5)",
      enterFrom: { opacity: 0 },
      swapAt: { opacity: 0.12 },
    });
  }, [duration, layoutId]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      closeModal();
    };
    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) closeModal();
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleClick);
      if (dialog.open) dialog.close();
      trigger?.classList.remove("is-open");
    };
  }, [closeModal]);

  const media = imageUrl ? (
    <img
      src={imageUrl}
      alt={imageAlt || title}
      className="h-full w-full object-cover"
      data-layout-id={`${layoutId}-media`}
    />
  ) : (
    <Avatar
      alt={title}
      fallback={title.slice(0, 2)}
      src=""
      size="md"
      className="h-full w-full rounded-xl border-border/70 text-base"
      data-layout-id={`${layoutId}-media`}
    />
  );

  return (
    <div ref={rootRef} className="ubhona-layout-modal-root">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "ubhona-layout-modal-trigger w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
        data-layout-id={layoutId}
        data-state={open ? "open" : "closed"}
        aria-label={ariaLabel || `Open ${title} preview`}
        aria-haspopup="dialog"
        onClick={openModal}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-black/25">
              {media}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-text-primary" data-layout-id={`${layoutId}-title`}>
                {title}
              </div>
              {subtitle ? (
                <div className="mt-0.5 truncate text-xs text-text-secondary/68" data-layout-id={`${layoutId}-subtitle`}>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
          {stats[0] ? (
            <div className="shrink-0 text-right" data-layout-id={`${layoutId}-stats`}>
              <div className="text-sm font-semibold text-text-primary">{stats[0].value}</div>
              <div className="text-[11px] text-text-secondary/60">{stats[0].label}</div>
            </div>
          ) : null}
        </div>
      </button>

      <dialog
        ref={dialogRef}
        className="ubhona-layout-modal-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <article
          className={cn(
            tokens.classes.surfaceElevated,
            "ubhona-layout-modal-card w-[min(92vw,620px)] overflow-hidden p-0",
            modalClassName
          )}
          data-layout-id={layoutId}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative h-48 overflow-hidden border-b border-border bg-black/25 sm:h-56">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={imageAlt || title}
                className="h-full w-full object-cover"
                data-layout-id={`${layoutId}-media`}
              />
            ) : (
              <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(255,106,26,0.2),rgba(0,0,0,0.2)_52%,rgba(0,0,0,0.44))]">
                <Avatar
                  alt={title}
                  fallback={title.slice(0, 2)}
                  src=""
                  size="lg"
                  className="h-20 w-20 rounded-2xl border-border/70 text-xl"
                  data-layout-id={`${layoutId}-media`}
                />
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeModal}
              aria-label={`Close ${title} preview`}
              className="absolute right-3 top-3 bg-black/45 text-text-primary backdrop-blur-md hover:bg-black/60"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            <div>
              {subtitle ? (
                <div className={cn("mb-1 text-primary/82", typography.label)} data-layout-id={`${layoutId}-subtitle`}>
                  {subtitle}
                </div>
              ) : null}
              <h2 id={titleId} className="text-xl font-semibold text-text-primary sm:text-2xl" data-layout-id={`${layoutId}-title`}>
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-2 text-sm leading-6 text-text-secondary/78" data-layout-id={`${layoutId}-description`}>
                  {description}
                </p>
              ) : null}
            </div>

            {stats.length ? (
              <dl className="grid gap-2 sm:grid-cols-3" data-layout-id={`${layoutId}-stats`}>
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-black/20 px-3 py-2.5">
                    <dt className="text-[11px] uppercase tracking-[0.08em] text-text-secondary/58">{stat.label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-text-primary">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {children ? <div className="text-sm leading-6 text-text-secondary/78">{children}</div> : null}
            {cta ? <div className="flex flex-wrap gap-2 border-t border-border pt-4">{cta}</div> : null}
          </div>
        </article>
      </dialog>
    </div>
  );
}
