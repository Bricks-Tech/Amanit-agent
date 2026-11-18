import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  TIME_ZONE_KEY,
  TIME_ZONES,
  browserTimeZone,
  readTimeZoneChoice,
  resolveTimeZone,
  setActiveTimeZone,
} from "./lib/timeZone";

type TimeZoneContextValue = {
  choice: string;
  timeZone: string;
  setChoice: (choice: string) => void;
};

const TimeZoneContext = createContext<TimeZoneContextValue | null>(null);

export function TimeZoneProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState(readTimeZoneChoice);
  const timeZone = resolveTimeZone(choice);
  setActiveTimeZone(timeZone);

  const value = useMemo(
    () => ({
      choice,
      timeZone,
      setChoice: (next: string) => {
        try {
          localStorage.setItem(TIME_ZONE_KEY, next);
        } catch {
          // Keep the in-memory choice when storage is unavailable.
        }
        setChoiceState(next);
      },
    }),
    [choice, timeZone]
  );

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone() {
  const value = useContext(TimeZoneContext);
  if (!value) {
    const timeZone = browserTimeZone();
    return {
      choice: "browser",
      timeZone,
      setChoice: () => undefined,
    };
  }
  return value;
}

export function TimeZoneSelect() {
  const { choice, setChoice } = useTimeZone();
  const browser = browserTimeZone();

  return (
    <label className="tz-field">
      <span>Timezone</span>
      <select value={choice} onChange={(event) => setChoice(event.target.value)} aria-label="Timezone">
        <option value="browser">Browser ({browser})</option>
        {TIME_ZONES.map((zone) => (
          <option key={zone.id} value={zone.id}>
            {zone.label} ({zone.id})
          </option>
        ))}
      </select>
    </label>
  );
}
