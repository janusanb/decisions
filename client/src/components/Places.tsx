import { useState, type FormEvent } from "react";
import type { AppState, ParticipantId } from "../../../shared/types.ts";
import { api } from "../api.ts";

type PlacesProps = {
  participantId: ParticipantId;
  state: AppState;
  selected: Set<string>;
  selecting: boolean;
  onToggle: (id: string) => void;
  onError: (message: string) => void;
};

export function Places({
  participantId,
  state,
  selected,
  selecting,
  onToggle,
  onError,
}: PlacesProps) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const due = state.restaurants.filter((place) => place.due);

  async function addPlace(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createRestaurant(participantId, name, notes);
      setName("");
      setNotes("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add that place.");
    }
  }

  async function logVisit(restaurantId: string) {
    try {
      await api.createVisit(participantId, restaurantId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not record the visit.");
    }
  }

  async function removePlace(restaurantId: string) {
    if (!confirm("Remove this restaurant from the list? Visit history is kept.")) return;
    try {
      await api.archiveRestaurant(participantId, restaurantId);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not remove that place.");
    }
  }

  return (
    <section className="panel places">
      <header className="panel-head">
        <p className="eyebrow">The ledger</p>
        <h2>Places</h2>
      </header>

      {due.length > 0 ? (
        <aside className="due-banner" data-testid="due-banner">
          <p>Due after {state.dueAfterDays} days</p>
          <strong>
            {due.length === 1 ? due[0]!.name : `${due.length} places`} deserve another look.
          </strong>
          <span>
            Recommended, not required. Include them only if you both want them on the wheel.
          </span>
        </aside>
      ) : null}

      <form className="place-form" onSubmit={addPlace}>
        <label>
          Add a restaurant
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Thai Garden"
            required
            maxLength={80}
          />
        </label>
        <label>
          Note
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Weeknight noodles"
            maxLength={500}
          />
        </label>
        <button type="submit" className="btn btn-ink">
          Add
        </button>
      </form>

      <ul className="place-list">
        {state.restaurants.map((place) => (
          <li key={place.id} className={place.due ? "is-due" : undefined}>
            {selecting ? (
              <label className="place-select">
                <input
                  type="checkbox"
                  checked={selected.has(place.id)}
                  onChange={() => onToggle(place.id)}
                />
                <span>
                  <strong>{place.name}</strong>
                  <em>
                    {place.neverVisited
                      ? "Not visited yet"
                      : place.due
                        ? `${place.daysSinceVisit} days ago`
                        : `${place.daysSinceVisit}d ago`}
                  </em>
                </span>
              </label>
            ) : (
              <div className="place-select">
                <span>
                  <strong>{place.name}</strong>
                  <em>
                    {place.neverVisited
                      ? "Not visited yet"
                      : `${place.daysSinceVisit} day${place.daysSinceVisit === 1 ? "" : "s"} ago`}
                  </em>
                </span>
              </div>
            )}
            {place.due ? <span className="pill">Due</span> : null}
            <div className="place-actions">
              <button type="button" className="text-btn" onClick={() => void logVisit(place.id)}>
                We went
              </button>
              <button type="button" className="text-btn" onClick={() => void removePlace(place.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
