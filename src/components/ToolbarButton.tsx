import type { ReactNode } from "react";

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
  onClick: () => void;
};

export function ToolbarButton({ active, disabled, title, children, onClick }: ToolbarButtonProps) {
  return (
    <button className={active ? "tool-button active" : "tool-button"} disabled={disabled} title={title} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
