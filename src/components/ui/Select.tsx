import * as React from "react";
import { UbhonaSelect, UbhonaSelectItem } from "./ubhona-select";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => {
  const { children, onChange, value, defaultValue, name, id, disabled, ...rest } = props;
  const normalizedValue = typeof value === "string" ? value : value == null ? undefined : String(value);
  const normalizedDefaultValue =
    typeof defaultValue === "string" ? defaultValue : defaultValue == null ? undefined : String(defaultValue);

  const options = React.useMemo(() => {
    return React.Children.toArray(children)
      .filter((child): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>> =>
        React.isValidElement(child)
      )
      .map((child) => ({
        value: String(child.props.value ?? ""),
        label: String(child.props.children ?? child.props.label ?? child.props.value ?? ""),
        disabled: Boolean(child.props.disabled),
      }))
      .filter((option) => option.value !== "");
  }, [children]);

  return (
    <>
      <UbhonaSelect
        id={id}
        name={name}
        value={normalizedValue}
        defaultValue={normalizedDefaultValue}
        disabled={disabled}
        className={className}
        onValueChange={(nextValue) => {
          if (!onChange) return;
          const event = {
            target: { value: nextValue, name: name || "" },
            currentTarget: { value: nextValue, name: name || "" },
          } as unknown as React.ChangeEvent<HTMLSelectElement>;
          onChange(event);
        }}
        options={options}
        placeholder={rest.placeholder || "Select an option"}
      />
      <select ref={ref} className="sr-only" tabIndex={-1} aria-hidden value={normalizedValue ?? ""} onChange={() => {}} />
    </>
  );
});

Select.displayName = "Select";
