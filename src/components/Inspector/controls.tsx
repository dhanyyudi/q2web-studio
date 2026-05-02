import type { ReactNode } from "react";
import { ColorField } from "../ColorField";

export type GeometryKind = "point" | "line" | "polygon" | "unknown";

export function PanelTitle({ title, icon }: { title: string; icon?: ReactNode }) {
  return <h2 className="panel-title">{icon}{title}</h2>;
}

export function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <ColorField label={label} value={value} onChange={onChange} />;
}

export function RangeInput(props: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{props.label}: {props.value}</span><input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(event) => props.onChange(Number(event.target.value))} /></label>;
}
