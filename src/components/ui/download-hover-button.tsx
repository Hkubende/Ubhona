import * as React from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, BookDownloadIcon } from "@hugeicons/core-free-icons";
import { cn } from "../../lib/utils";

type DownloadHoverButtonProps = {
  href: string;
  label?: string;
  className?: string;
};

export function DownloadHoverButton({
  href,
  label = "View Product Brief",
  className,
}: DownloadHoverButtonProps) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-2xl border border-[#E4572E]/45",
        "bg-[#E4572E] px-4 py-3 text-sm font-black text-black transition hover:bg-[#ff6d40]",
        className
      )}
      download
    >
      <HugeiconsIcon icon={BookDownloadIcon} size={18} strokeWidth={2} />
      <span>{label}</span>
      <motion.span
        initial={{ width: 0, opacity: 0 }}
        whileHover={{ width: "1.1rem", opacity: 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="inline-flex items-center justify-end overflow-hidden"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2.2} />
      </motion.span>
    </a>
  );
}
