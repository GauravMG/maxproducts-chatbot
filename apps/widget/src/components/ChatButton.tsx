export function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="mpe-launcher" onClick={onClick} aria-label="Open chat">
      💬
    </button>
  );
}
