import type { ActionCard } from "@mpe-chatbot/shared";

export function LoginPromptCard({ card }: { card: Extract<ActionCard, { type: "login_prompt" }> }) {
  return (
    <div className="mpe-card">
      <div className="mpe-card-title">Login required</div>
      <div className="mpe-address-block">{card.message}</div>
      <div className="mpe-card-actions">
        <button className="mpe-btn" onClick={() => (window.location.href = card.loginUrl)}>
          Log in
        </button>
      </div>
    </div>
  );
}
