import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion } from "../../design-system";

export type UbhonaSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type UbhonaSelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options?: UbhonaSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  id?: string;
  name?: string;
  "aria-label"?: string;
  children?: React.ReactNode;
};

export function UbhonaSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled,
  className,
  triggerClassName,
  contentClassName,
  id,
  name,
  children,
  ...props
}: UbhonaSelectProps) {
  return (
    <SelectPrimitive.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        className={cn(
          `inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[rgba(232,216,195,0.16)] bg-[linear-gradient(180deg,rgba(60,42,33,0.94),rgba(30,21,17,0.98))] px-3 text-sm font-medium text-[#FBF6EE] shadow-[0_14px_30px_rgba(14,10,8,0.26),inset_0_1px_0_rgba(255,248,241,0.06)] outline-none hover:border-primary/38 hover:bg-[linear-gradient(180deg,rgba(68,48,38,0.96),rgba(33,24,19,1))] focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a120f] data-[placeholder]:text-[#E8D8C3]/68 disabled:cursor-not-allowed disabled:opacity-60 ${motion.standard}`,
          triggerClassName,
          className
        )}
        {...props}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 text-[#E8D8C3]/70" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-[80] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(38,26,20,0.98),rgba(24,18,15,0.96))] p-1 text-text-primary shadow-elevated",
            "backdrop-blur-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            contentClassName
          )}
        >
          <SelectPrimitive.Viewport className="max-h-72 p-1">
            {options
              ? options.map((option) => (
                  <UbhonaSelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </UbhonaSelectItem>
                ))
              : children}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

type UbhonaSelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;

export function UbhonaSelectItem({ className, children, ...props }: UbhonaSelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2.5 pl-8 pr-3 text-sm text-text-primary outline-none transition-colors",
        "hover:bg-white/[0.07] focus:bg-primary/14 data-[state=checked]:bg-primary/18 data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 inline-flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-3.5 w-3.5 text-primary" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
