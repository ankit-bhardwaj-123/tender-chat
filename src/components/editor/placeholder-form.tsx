"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

interface PlaceholderFormProps {
  placeholders: readonly string[] | null;
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

export function PlaceholderForm({ placeholders, values, onChange }: PlaceholderFormProps) {
  if (placeholders === null) {
    return (
      <p className="px-6 py-8 text-sm text-muted-foreground">Pick a template to see its blanks.</p>
    );
  }
  if (placeholders.length === 0) {
    return <p className="px-6 py-8 text-sm text-muted-foreground">This template has no blanks.</p>;
  }
  return (
    <form
      aria-label="Template blanks"
      className="flex flex-col gap-4 px-6 py-5"
      onSubmit={(event) => event.preventDefault()}
    >
      {placeholders.map((name, index) => {
        const id = `blank-${index}`;
        return (
          <Field key={name}>
            <FieldLabel htmlFor={id} lang="hi">
              {name}
            </FieldLabel>
            <Textarea
              id={id}
              lang="hi"
              rows={1}
              className="min-h-8"
              value={values[name] ?? ""}
              onChange={(event) => onChange(name, event.target.value)}
            />
          </Field>
        );
      })}
    </form>
  );
}
