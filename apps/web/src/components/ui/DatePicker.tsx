"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { tr } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { Popover } from "./Popover";
import { Button } from "./Button";
import { Icon } from "./Icon";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  id?: string;
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DatePicker({ value, onChange, placeholder = "Tarih seçin", id }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <div className="date-input-wrap">
      <Popover
        open={open}
        onOpenChange={setOpen}
        className="calendar-popover"
        trigger={
          <button
            type="button"
            id={id}
            className={`date-input-trigger ${!value ? "placeholder" : ""}`}
          >
            <span>{value ? format(parseISO(value), "d MMM yyyy", { locale: tr }) : placeholder}</span>
            <Icon name="calendar" className="date-input-icon" size={16} />
          </button>
        }
      >
        <DayPicker
          mode="single"
          locale={tr}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toIsoDate(d));
              setOpen(false);
            }
          }}
        />
        <div className="calendar-footer">
          <Button
            variant="link"
            onClick={() => {
              onChange(toIsoDate(new Date()));
              setOpen(false);
            }}
          >
            Bugün
          </Button>
          <Button
            variant="link"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Temizle
          </Button>
        </div>
      </Popover>
    </div>
  );
}
