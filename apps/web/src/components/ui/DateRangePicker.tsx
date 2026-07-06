"use client";

import { useCallback, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { tr } from "date-fns/locale";
import { format, parseISO, startOfMonth, subDays } from "date-fns";
import { Popover } from "./Popover";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { FormField } from "./FormField";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply?: () => void;
  showPresets?: boolean;
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatLabel(from: string, to: string) {
  if (!from && !to) return "Tarih aralığı";
  if (from && to) {
    return `${format(parseISO(from), "d MMM", { locale: tr })} – ${format(parseISO(to), "d MMM yyyy", { locale: tr })}`;
  }
  if (from) return format(parseISO(from), "d MMM yyyy", { locale: tr });
  return "";
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
    <div className="toolbar">
      {showPresets ? (
        <div className="toolbar-presets">
          {[
            { key: "7d", label: "7 gün", days: 7 },
            { key: "30d", label: "30 gün", days: 30 },
            { key: "month", label: "Bu ay" },
          ].map((p) => (
            <button
              key={p.key}
              type="button"
              className={`toolbar-preset ${activePreset === p.key ? "active" : ""}`}
              onClick={() => applyPreset(p.key, p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      <FormField label="Tarih aralığı" className="mb-0">
        <Popover
          open={open}
          onOpenChange={setOpen}
          className="calendar-popover"
          trigger={
            <button type="button" className={`date-input-trigger ${!from && !to ? "placeholder" : ""}`}>
              <span>{formatLabel(from, to)}</span>
              <Icon name="calendar" className="date-input-icon" size={16} />
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
            }}
            numberOfMonths={1}
          />
          <div className="calendar-footer">
            <Button
              variant="link"
              onClick={() => {
                const today = toIsoDate(new Date());
                onFromChange(today);
                onToChange(today);
                setOpen(false);
              }}
            >
              Bugün
            </Button>
            <Button
              variant="link"
              onClick={() => {
                onFromChange("");
                onToChange("");
                setActivePreset(null);
                setOpen(false);
              }}
            >
              Temizle
            </Button>
          </div>
        </Popover>
      </FormField>

      {onApply ? (
        <Button variant="primary" onClick={onApply}>
          Uygula
        </Button>
      ) : null}
    </div>
  );
}
