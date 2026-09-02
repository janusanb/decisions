import type { ParticipantId } from "../../../shared/types.ts";

type SeatGateProps = {
  onChoose: (id: ParticipantId) => void;
};

export function SeatGate({ onChoose }: SeatGateProps) {
  return (
    <main className="gate">
      <p className="eyebrow">Decision Wheel</p>
      <h1>Who’s sitting at this device?</h1>
      <p className="lede">
        Two seats. One shared kitchen ledger. Your picks stay sealed until both of you lock in.
      </p>
      <div className="seat-grid">
        <button type="button" className="seat-card" onClick={() => onChoose("a")}>
          <span className="seat-ticket">Seat A</span>
          <strong>Person A</strong>
          <span>This name can change after you sit down.</span>
        </button>
        <button type="button" className="seat-card seat-card-b" onClick={() => onChoose("b")}>
          <span className="seat-ticket">Seat B</span>
          <strong>Person B</strong>
          <span>Pick the other chair on the second phone or laptop.</span>
        </button>
      </div>
    </main>
  );
}
