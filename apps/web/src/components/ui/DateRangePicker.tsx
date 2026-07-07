"use client";

import { useCallback, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { tr } from "date-fns/locale";
import { format, parseISO, startOfMonth, subDays } from "date-fns";
import { Popover } from "./Popover";
import { Icon } from "./Icon";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply?: () => void;
  showPresets?: boolean;
}

const PRESETS = [
  { key: "7d", label: "7G", days: 7 },
  { key: "30d", label: "30G", days: 30 },
  { key: "month", label: "Bu ay" },
] as const;

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatLabel(from: string, to: string) {
  if (!from && !to) return "Tarih seç";
  if (from && to) {
    return `${format(parseISO(from), "d MMM", { locale: tr })} – ${format(parseISO(to), "d MMM yyyy", { locale: tr })}`;
  }
  if (from) return format(parseISO(from), "d MMM yyyy", { locale: tr });
  return "Tarih seç";
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  showPresets = true,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const range: DateRange | undefined =
    from || to
      ? {
          from: from ? parseISO(from) : undefined,
          to: to ? parseISO(to) : undefined,
        }
      : undefined;

  const applyPreset = useCallback(
    (key: string, days?: number) => {
      const today = new Date();
      let start: Date;
      const end = today;
      if (key === "7d" && days) {
        start = subDays(today, days);
      } else if (key === "30d" && days) {
        start = subDays(today, days);
      } else if (key === "month") {
        start = startOfMonth(today);
      } else {
        return;
      }
      onFromChange(toIsoDate(start));
      onToChange(toIsoDate(end));
      setActivePreset(key);
    },
    [onFromChange, onToChange],
  );

  return (
    <div className="date-range-picker">
      {showPresets ? (
        <div className="date-range-picker__presets" role="group" aria-label="Hızlı tarih seçimi">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`date-range-picker__preset${activePreset === p.key ? " is-active" : ""}`}
              onClick={() => applyPreset(p.key, "days" in p ? p.days : undefined)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      <Popover
        open={open}
        onOpenChange={setOpen}
        className="calendar-popover"
        trigger={
          <button
            type="button"
            className={`date-range-picker__trigger${!from && !to ? " is-placeholder" : ""}`}
          >
            <Icon name="calendar" className="date-range-picker__icon" size={15} />
            <span className="date-range-picker__label">{formatLabel(from, to)}</span>
          </button>
        }
      >
        <DayPicker
          mode="range"
          locale={tr}
          selected={range}
          onSelect={(r) => {
            setActivePreset(null);
            onFromChange(r?.from ? toIsoDate(r.from) : "");
            onToChange(r?.to ? toIsoDate(r.to) : "");
            if (r?.from && r?.to) setOpen(false);
          }}
          numberOfMonths={1}
        />
        <div className="calendar-footer">
          <button
            type="button"
            className="calendar-footer__btn"
            onClick={() => {
              const today = toIsoDate(new Date());
              onFromChange(today);
              onToChange(today);
              setActivePreset(null);
              setOpen(false);
            }}
          >
            Bugün
          </button>
          <button
            type="button"
            className="calendar-footer__btn"
            onClick={() => {
              onFromChange("");
              onToChange("");
              setActivePreset(null);
              setOpen(false);
            }}
          >
            Temizle
          </button>
        </div>
      </Popover>

      {onApply ? (
        <button type="button" className="date-range-picker__apply btn btn-primary btn-sm" onClick={onApply}>
          Uygula
        </button>
      ) : null}
    </div>
  );
}
