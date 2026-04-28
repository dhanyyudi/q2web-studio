import type { ReactNode } from "react";

type ToolbarButtonProps = {
  active?: boolean;
  title: string;
  children: ReactNode;
  onClick: () => void;
};

export function ToolbarButton({ active, title, children, onClick }: ToolbarButtonProps) {
  return (
    <button className={active ? "tool-button active" : "tool-button"} title={title} type="button" onClick={onClick}>
      {children}
    </button>
  );
}
