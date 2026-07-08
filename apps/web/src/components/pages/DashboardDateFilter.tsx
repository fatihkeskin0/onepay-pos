"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import {
  differenceInCalendarDays,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { tr } from "date-fns/locale";
import { Popover } from "@/components/ui/Popover";
import { Icon } from "@/components/ui/Icon";
import type { DashboardDateRange } from "@/lib/dashboard-date-range";

export type { DashboardDateRange };

interface DashboardDateFilterProps {
  value: DashboardDateRange;
  onChange: (range: DashboardDateRange) => void;
}

const MAX_RANGE_DAYS = 62;

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function todayDate(): Date {
  return startOfDay(new Date());
}

function formatRangeLabel(from: string, to: string): string {
  if (!from) return "Aralık";
  if (from === to) return format(parseISO(from), "d MMM yyyy", { locale: tr });
  return `${format(parseISO(from), "d MMM", { locale: tr })} – ${format(parseISO(to), "d MMM yyyy", { locale: tr })}`;
}

function clampRange(from: Date, to: Date, today: Date): DashboardDateRange {
  const toDate = to > today ? today : to;
  let fromDate = from > toDate ? toDate : from;

  if (differenceInCalendarDays(toDate, fromDate) > MAX_RANGE_DAYS) {
    fromDate = subDays(toDate, MAX_RANGE_DAYS);
  }

  return { from: toIsoDate(fromDate), to: toIsoDate(toDate) };
}

function toDateRange(range: DashboardDateRange): DateRange {
  return {
    from: range.from ? parseISO(range.from) : undefined,
    to: range.to ? parseISO(range.to) : undefined,
  };
}

function isPresetToday(value: DashboardDateRange, today: Date): boolean {
  const iso = toIsoDate(today);
  return value.from === iso && value.to === iso;
}

function isPresetYesterday(value: DashboardDateRange, yesterday: Date): boolean {
  const iso = toIsoDate(yesterday);
  return value.from === iso && value.to === iso;
}

function orderRange(from: Date, to: Date): { from: Date; to: Date } {
  if (isBefore(to, from)) return { from: to, to: from };
  return { from, to };
}

export function DashboardDateFilter({ value, onChange }: DashboardDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [pickerMonth, setPickerMonth] = useState<Date>(() => todayDate());
  const draftRef = useRef<DateRange | undefined>(undefined);
  const today = useMemo(() => todayDate(), []);
  const yesterday = useMemo(() => subDays(today, 1), [today]);

  const isToday = isPresetToday(value, today);
  const isYesterday = isPresetYesterday(value, yesterday);
  const isCustom = !isToday && !isYesterday;

  const resetDraft = useCallback(() => {
    draftRef.current = undefined;
    setDraftRange(undefined);
  }, []);

  const commitRange = useCallback(
    (from: Date, to: Date) => {
      const next = clampRange(from, to, today);
      onChange(next);
    },
    [onChange, today],
  );

  const finishRange = useCallback(
    (from: Date, to: Date) => {
      commitRange(from, to);
      resetDraft();
      setOpen(false);
    },
    [commitRange, resetDraft],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        const editingCustom = !isPresetToday(value, today) && !isPresetYesterday(value, yesterday);
        const initial = editingCustom ? toDateRange(value) : undefined;
        draftRef.current = initial;
        setDraftRange(initial);
        setPickerMonth(
          editingCustom && value.from ? parseISO(value.from) : today,
        );
        return;
      }
      resetDraft();
    },
    [resetDraft, today, value],
  );

  const handlePreset = useCallback(
    (from: Date, to: Date) => {
      commitRange(from, to);
      setOpen(false);
      resetDraft();
    },
    [commitRange, resetDraft],
  );

  const handleSelect = useCallback(
    (_range: DateRange | undefined, triggerDate: Date) => {
      const clicked = startOfDay(triggerDate);
      const prev = draftRef.current;

      if (!prev?.from) {
        const next = { from: clicked, to: undefined };
        draftRef.current = next;
        setDraftRange(next);
        return;
      }

      if (prev.from && prev.to) {
        const next = { from: clicked, to: undefined };
        draftRef.current = next;
        setDraftRange(next);
        return;
      }

      if (isSameDay(prev.from, clicked)) {
        finishRange(clicked, clicked);
        return;
      }

      const ordered = orderRange(prev.from, clicked);
      finishRange(ordered.from, ordered.to);
    },
    [finishRange],
  );

  const hint = useMemo(() => {
    if (!draftRange?.from) {
      return "Başlangıç tarihini seçin";
    }
    if (!draftRange.to) {
      const startLabel = format(draftRange.from, "d MMM yyyy", { locale: tr });
      return `${startLabel} — bitiş tarihini seçin (tek gün için aynı tarihe tekrar tıklayın)`;
    }
    return formatRangeLabel(toIsoDate(draftRange.from), toIsoDate(draftRange.to));
  }, [draftRange]);

  const showPresetToday = isToday && !open;
  const showPresetYesterday = isYesterday && !open;
  const showRangeActive = isCustom || open;

  return (
    <div className={`dash-date-filter${open ? " is-open" : ""}`}>
      <div className="dash-date-filter__bar" role="group" aria-label="Tarih filtresi">
        <button
          type="button"
          className={`dash-date-filter__segment${showPresetToday ? " is-active" : ""}`}
          onClick={() => handlePreset(today, today)}
        >
          Bugün
        </button>
        <button
          type="button"
          className={`dash-date-filter__segment${showPresetYesterday ? " is-active" : ""}`}
          onClick={() => handlePreset(yesterday, yesterday)}
        >
          Dün
        </button>

        <span className="dash-date-filter__sep" aria-hidden="true" />

        <Popover
          open={open}
          onOpenChange={handleOpenChange}
          className="calendar-popover"
          align="end"
          trigger={
            <button
              type="button"
              className={`dash-date-filter__segment dash-date-filter__segment--range${showRangeActive ? " is-active" : ""}${open ? " is-open" : ""}`}
              aria-expanded={open}
              aria-haspopup="dialog"
            >
              <Icon name="calendar" size={14} />
              <span className="dash-date-filter__segment-label">
                {isCustom ? formatRangeLabel(value.from, value.to) : "Aralık"}
              </span>
              <Icon name="chevron-down" size={12} className="dash-date-filter__chevron" />
            </button>
          }
        >
          <p className="dash-date-filter__hint">{hint}</p>
          <DayPicker
            mode="range"
            locale={tr}
            numberOfMonths={1}
            showOutsideDays={false}
            month={pickerMonth}
            onMonthChange={setPickerMonth}
            selected={draftRange}
            disabled={{ after: today }}
            onSelect={handleSelect}
          />
          <div className="calendar-footer">
            <button
              type="button"
              className="calendar-footer__btn"
              onClick={() => handleOpenChange(false)}
            >
              İptal
            </button>
          </div>
        </Popover>
      </div>
    </div>
  );
}

export function formatDashboardRangeLabel(from: string, to: string): string {
  if (from === to) {
    return format(parseISO(from), "d MMMM yyyy, EEEE", { locale: tr });
  }
  return `${format(parseISO(from), "d MMM yyyy", { locale: tr })} – ${format(parseISO(to), "d MMM yyyy", { locale: tr })}`;
}

export function todayIsoDate(): string {
  return toIsoDate(todayDate());
}

export function todayRange(): DashboardDateRange {
  const t = todayIsoDate();
  return { from: t, to: t };
}
