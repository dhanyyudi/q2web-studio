import { useEffect, useId, useState } from "react";
import {
  DASH_ARRAY_PRESETS,
  getDashArrayPresetKey,
  isValidDashArray,
  normalizeDashArray
} from "../../lib/dashArray";

export type DashArrayFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

function previewDashArray(value: string) {
  return value || "none";
}

export function DashArrayField({ label, value, onChange, disabled = false }: DashArrayFieldProps) {
  const id = useId();
  const customInputId = `${id}-custom`;
  const noteId = `${id}-note`;
  const normalizedValue = normalizeDashArray(value);
  const fallbackValue = normalizedValue;
  const [draftValue, setDraftValue] = useState(normalizedValue);
  const [touched, setTouched] = useState(false);
  const activePreset = getDashArrayPresetKey(normalizedValue);
  const invalid = touched && !isValidDashArray(draftValue);

  useEffect(() => {
    setDraftValue(normalizedValue);
  }, [normalizedValue]);

  const commitDraft = (nextDraft: string) => {
    const normalized = normalizeDashArray(nextDraft);
    setDraftValue(normalized);
    setTouched(true);
    if (isValidDashArray(normalized)) {
      onChange(normalized);
    }
  };

  return (
    <label className="field dash-array-field" htmlFor={customInputId}>
      <span>{label}</span>
      <div className="dash-array-presets" role="group" aria-label={`${label} presets`}>
        {DASH_ARRAY_PRESETS.map((preset) => {
          const selected = preset.key === activePreset;
          return (
            <button
              key={preset.key}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              className={selected ? "active" : ""}
              onClick={() => {
                setTouched(false);
                if (preset.key === "custom") {
                  setDraftValue(fallbackValue);
                  return;
                }
                setDraftValue(preset.value);
                onChange(preset.value);
              }}
            >
              <span className="dash-array-preset-label">
                {selected ? "✓ " : ""}{preset.label}
              </span>
              <svg width="60" height="10" viewBox="0 0 60 10" aria-hidden="true" focusable="false">
                <line
                  x1="2"
                  y1="5"
                  x2="58"
                  y2="5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={previewDashArray(preset.value)}
                />
              </svg>
            </button>
          );
        })}
      </div>
      <input
        id={customInputId}
        aria-label="Dash array custom"
        value={draftValue}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={noteId}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraftValue(nextDraft);
          if (isValidDashArray(nextDraft)) {
            onChange(normalizeDashArray(nextDraft));
          }
        }}
        onBlur={(event) => commitDraft(event.target.value)}
      />
      {invalid ? (
        <small id={noteId} className="editor-note error" role="alert" aria-live="polite">Use numbers and spaces only, for example 6 4 or 10 4 2 4.</small>
      ) : (
        <small id={noteId} className="editor-note">Use presets or enter positive numbers separated by spaces.</small>
      )}
    </label>
  );
}
