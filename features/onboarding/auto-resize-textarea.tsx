"use client";

import { useEffect, useRef } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minRows?: number;
  disabled?: boolean;
};

export function AutoResizeTextarea({
  id,
  value,
  onChange,
  className = "ui-textarea",
  minRows = 2,
  disabled = false,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20;
    const minHeight = lineHeight * minRows + 20;
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minRows]);

  return (
    <textarea
      ref={ref}
      id={id}
      className={`${className} auto-resize-textarea`}
      rows={minRows}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
