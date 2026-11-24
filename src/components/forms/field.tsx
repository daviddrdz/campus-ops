"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

type ControlProps = {
  id: string;
  name: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: (control: ControlProps) => ReactNode;
};

export function Field({ name, label, error, optional, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground">(opcional)</span>
        ) : null}
      </Label>
      {children({
        id,
        name,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
