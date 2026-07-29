import type { ActionCard } from "@mpe-chatbot/shared";

export function AddressCard({ card }: { card: Extract<ActionCard, { type: "address_confirmation" }> }) {
  const a = card.address;
  return (
    <div className="mpe-card">
      <div className="mpe-card-title">
        {card.addressType === "billing" ? "Billing" : "Shipping"} address updated
      </div>
      <div className="mpe-address-block">
        {a.firstName} {a.lastName}
        {a.company && (
          <>
            <br />
            {a.company}
          </>
        )}
        <br />
        {a.address1}
        {a.address2 && (
          <>
            <br />
            {a.address2}
          </>
        )}
        <br />
        {a.city} {a.postcode}
        <br />
        {a.country}
      </div>
    </div>
  );
}
