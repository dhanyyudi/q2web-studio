import { HexColorInput, HexColorPicker } from "react-colorful";
import { Paintbrush } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const hexInputLabel = `${label} hex color`;

  return (
    <div className="field color-field">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="color-trigger">
            <span className="color-swatch" style={{ background: value }} />
            <span>{value}</span>
            <Paintbrush />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="color-popover">
          <HexColorPicker color={value} onChange={onChange} aria-label={hexInputLabel} />
          <HexColorInput
            prefixed
            color={value}
            onChange={onChange}
            className="color-hex-input"
            aria-label={hexInputLabel}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
