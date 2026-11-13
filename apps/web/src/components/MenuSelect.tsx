import { useEffect, useId, useRef, useState } from "react";

export type MenuSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: MenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  ariaLabel?: string;
  leadingIcon?: string;
  chevronIcon?: string;
};

export function MenuSelect({
  value,
  options,
  onChange,
  className,
  triggerClassName,
  menuClassName,
  ariaLabel,
  leadingIcon,
  chevronIcon = "/assets/icon-chevron.svg",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`menu-select${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`menu-select-trigger${triggerClassName ? ` ${triggerClassName}` : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
      >
        {leadingIcon ? <img src={leadingIcon} alt="" width={16} height={16} /> : null}
        <span className="menu-select-value">{selected?.label ?? ""}</span>
        <img
          className={`menu-select-chevron${open ? " menu-select-chevron--open" : ""}`}
          src={chevronIcon}
          alt=""
          width={16}
          height={16}
        />
      </button>

      {open ? (
        <ul className={`menu-select-menu${menuClassName ? ` ${menuClassName}` : ""}`} id={listId} role="listbox">
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  className={`menu-select-option${isActive ? " menu-select-option--active" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
