import { useState, type KeyboardEvent } from "react";

export function InputBar({
  sending,
  onSend,
  placeholder = "Ask about products, orders, invoices...",
}: {
  sending: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (!value.trim() || sending) return;
    onSend(value);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="mpe-input-bar">
      <input
        className="mpe-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={sending}
      />
      <button className="mpe-send-btn" onClick={submit} disabled={sending || !value.trim()} aria-label="Send">
        &#10148;
      </button>
    </div>
  );
}
