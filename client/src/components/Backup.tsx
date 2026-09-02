import { useRef, type ChangeEvent } from "react";
import type { BackupPayload, ParticipantId } from "../../../shared/types.ts";
import { api } from "../api.ts";

type BackupProps = {
  participantId: ParticipantId;
  onError: (message: string) => void;
};

export function Backup({ participantId, onError }: BackupProps) {
  const input = useRef<HTMLInputElement>(null);

  async function download() {
    try {
      const payload = await api.exportBackup(participantId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `decision-wheel-${payload.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!confirm("Replace all shared data with this backup?")) return;
    try {
      const payload = JSON.parse(await file.text()) as BackupPayload;
      await api.importBackup(participantId, payload);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <section className="panel backup">
      <header className="panel-head">
        <p className="eyebrow">Portable copy</p>
        <h2>Backup</h2>
      </header>
      <p className="lede">
        JSON export is for moving the ledger. SQLite on the host is the live shared copy.
      </p>
      <div className="action-row">
        <button type="button" className="btn btn-ink" onClick={() => void download()}>
          Export JSON
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>
          Import JSON
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => void onFile(event)}
        />
      </div>
    </section>
  );
}
