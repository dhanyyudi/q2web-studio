import { useEffect, useId, useState } from "react";

export type RangeNumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  helpText?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function formatNumber(value: number) {
  return String(value);
}

function parseDraft(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "+" || trimmed === "." || trimmed === "-." || trimmed === "+.") {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function RangeNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  helpText
}: RangeNumberFieldProps) {
  const id = useId();
  const safeValue = clamp(normalizeNumber(value, min), min, max);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(() => formatNumber(safeValue));
  const helpTextId = helpText ? `${id}-help` : undefined;

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(formatNumber(safeValue));
    }
  }, [isEditing, safeValue]);

  const commitDraft = (draft: string, fallback = safeValue) => {
    const parsed = parseDraft(draft);
    const next = clamp(parsed ?? fallback, min, max);
    setDraftValue(formatNumber(next));
    onChange(next);
  };

  return (
    <label className="field range-number-field" htmlFor={`${id}-range`}>
      <span>{label}</span>
      {helpText ? (
        <small id={helpTextId} className="editor-note">
          {helpText}
        </small>
      ) : null}
      <div className="range-number-field-row">
        <input
          id={`${id}-range`}
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          aria-describedby={helpTextId}
          onChange={(event) => {
            const next = clamp(Number(event.target.value), min, max);
            setDraftValue(formatNumber(next));
            onChange(next);
          }}
        />
        <input
          id={`${id}-number`}
          aria-label={`${label} value`}
          className="range-number-field-input"
          type="number"
          min={min}
          max={max}
          step={step}
          value={draftValue}
          aria-describedby={helpTextId}
          onFocus={() => setIsEditing(true)}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraftValue(nextDraft);
            const parsed = parseDraft(nextDraft);
            if (parsed !== null) {
              onChange(clamp(parsed, min, max));
            }
          }}
          onBlur={(event) => {
            setIsEditing(false);
            commitDraft(event.target.value);
          }}
        />
        {unit ? <span className="range-number-field-unit">{unit}</span> : null}
      </div>
    </label>
  );
}
