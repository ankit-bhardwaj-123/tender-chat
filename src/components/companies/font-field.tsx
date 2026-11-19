"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FONTS, fontOf, fontStack } from "@/shared/fonts";

interface FontFieldProps {
  value: string | null;
  onChange: (fontKey: string | null) => void;
  disabled: boolean;
}

const NO_FONT = "none";
const SAMPLE = "नमस्ते निविदा";

export function FontField({ value, onChange, disabled }: FontFieldProps) {
  const shown = fontOf(value);

  return (
    <Field>
      <FieldLabel htmlFor="company-font">Font</FieldLabel>
      <Select
        value={value ?? NO_FONT}
        onValueChange={(next) => onChange(next === NO_FONT ? null : next)}
        disabled={disabled}
      >
        <SelectTrigger
          id="company-font"
          className="w-full"
          style={{ fontFamily: fontStack(shown) }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_FONT} style={{ fontFamily: fontStack(fontOf(null)) }}>
            No font ({fontOf(null).label})
          </SelectItem>
          {FONTS.map((font) => (
            <SelectItem key={font.key} value={font.key} style={{ fontFamily: fontStack(font) }}>
              <span className="flex items-baseline gap-2">
                <span>{font.label}</span>
                <span lang="hi" className="text-muted-foreground">
                  {SAMPLE}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
