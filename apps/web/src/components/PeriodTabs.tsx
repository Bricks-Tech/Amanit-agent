type Period = "today" | "week" | "month";

type Props = {
  value: Period;
  onChange: (value: Period) => void;
};

const OPTIONS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function PeriodTabs({ value, onChange }: Props) {
  return (
    <>
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "period-btn active" : "period-btn"}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </>
  );
}

export type { Period };
