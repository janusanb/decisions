import { useEffect, useState } from "react";

type AccessInfo = {
  shareUrl: string | null;
};

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function LanHint() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/access")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AccessInfo | null) => {
        if (data?.shareUrl) setShareUrl(data.shareUrl);
      })
      .catch(() => {
        // The hint still explains localhost without a detected IP.
      });
  }, []);

  const local = isLoopback(window.location.hostname);
  if (!local && !shareUrl) return null;

  return (
    <aside className="lan-hint" data-testid="lan-hint">
      {local ? (
        <>
          <strong>127.0.0.1 only works on this computer.</strong>
          <span>
            On the other phone or laptop, open{" "}
            {shareUrl ? (
              <a href={shareUrl}>{shareUrl}</a>
            ) : (
              "this computer’s Wi-Fi IP (run npm run lan-url on the host)"
            )}
            . Do not type localhost.
          </span>
        </>
      ) : (
        <span>
          Shared URL: <a href={shareUrl ?? undefined}>{shareUrl}</a>
        </span>
      )}
    </aside>
  );
}
