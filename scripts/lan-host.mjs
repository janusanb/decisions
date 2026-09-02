import { execFileSync } from "node:child_process";
import os from "node:os";

function lanHost() {
  if (process.platform === "darwin") {
    for (const iface of ["en0", "en1"]) {
      try {
        const ip = execFileSync("ipconfig", ["getifaddr", iface], { encoding: "utf8" }).trim();
        if (ip) return ip;
      } catch {
        // Interface is down or has no IPv4 address.
      }
    }
  }

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      const ipv4 = addr.family === "IPv4" || addr.family === 4;
      if (ipv4 && !addr.internal) return addr.address;
    }
  }

  return null;
}

const host = lanHost();
if (process.argv.includes("--host")) {
  if (!host) process.exit(1);
  process.stdout.write(host);
} else {
  console.log(host ? `http://${host}:3000` : "No LAN address found.");
}
