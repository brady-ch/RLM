import React, { useEffect, useId, useRef, useState } from "react";

export type GraphActionModalMode = "prompt" | "confirm";

export type GraphActionModalProps = {
  open: boolean;
  mode: GraphActionModalMode;
  title: string;
  description?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function GraphActionModal({
  open,
  mode,
  title,
  description,
  inputLabel,
  inputPlaceholder,
  confirmLabel = "Submit",
  cancelLabel = "Cancel",
  onCancel,
  onSubmit,
}: GraphActionModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) {
      setValue("");
      return;
    }
    if (mode === "prompt") {
      inputRef.current?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, onCancel]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    if (mode === "prompt" && !value.trim()) {
      return;
    }
    onSubmit(mode === "prompt" ? value.trim() : "confirmed");
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <h2 id={titleId}>{title}</h2>
        </div>
        {description ? <p>{description}</p> : null}
        {mode === "prompt" ? (
          <>
            {inputLabel ? <label htmlFor={`${titleId}-input`}>{inputLabel}</label> : null}
            <input
              id={`${titleId}-input`}
              ref={inputRef}
              value={value}
              placeholder={inputPlaceholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </>
        ) : null}
        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" onClick={handleSubmit}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
