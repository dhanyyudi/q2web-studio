import type { ReactNode } from "react";

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  title: string;
  shortcut?: string;
  children: ReactNode;
  onClick: () => void;
};

export function ToolbarButton({ active, disabled, title, shortcut, children, onClick }: ToolbarButtonProps) {
  return (
    <button className={active ? "tool-button active" : "tool-button"} disabled={disabled} title={shortcut ? `${title} (${shortcut})` : title} type="button" onClick={onClick}>
      {children}
      {shortcut && <span className="tool-keycap">{shortcut}</span>}
    </button>
  );
}
