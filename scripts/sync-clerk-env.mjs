// Merges Clerk keys from fieldserve-crm/.env.local into the root .env used by Docker.
// Derives CLERK_JWKS_URL and CLERK_ISSUER from the publishable key.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const srcPath = resolve(root, "fieldserve-crm", ".env.local");
const dstPath = resolve(root, ".env");

if (!existsSync(srcPath)) {
  console.error("Missing", srcPath);
  process.exit(1);
}

const parse = (text) => {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
};

const src = parse(readFileSync(srcPath, "utf8"));
const pk = src.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? src.CLERK_PUBLISHABLE_KEY;
const sk = src.CLERK_SECRET_KEY;
if (!pk || !sk) {
  console.error("Expected EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local");
  process.exit(1);
}

// pk format: pk_(test|live)_<base64url>  -> decoded is "<frontend-api>$"
const b64 = pk.replace(/^pk_(test|live)_/, "");
const decoded = Buffer.from(b64, "base64").toString("utf8").replace(/\$+$/, "").trim();
const issuer = `https://${decoded}`;
const jwks = `${issuer}/.well-known/jwks.json`;

const desired = {
  CLERK_SECRET_KEY: sk,
  CLERK_JWKS_URL: jwks,
  CLERK_ISSUER: issuer,
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: pk,
};

const existing = existsSync(dstPath) ? readFileSync(dstPath, "utf8") : "";
const lines = existing.split(/\r?\n/);
const seen = new Set();
const out = [];
for (const line of lines) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) {
    const key = line.slice(0, i).trim();
    if (key in desired) {
      out.push(`${key}=${desired[key]}`);
      seen.add(key);
      continue;
    }
  }
  out.push(line);
}
for (const [k, v] of Object.entries(desired)) {
  if (!seen.has(k)) out.push(`${k}=${v}`);
}
// trim trailing blank lines
while (out.length && !out[out.length - 1].trim()) out.pop();
writeFileSync(dstPath, out.join("\n") + "\n");

console.log("Updated", dstPath);
console.log("Keys synced: CLERK_SECRET_KEY, CLERK_JWKS_URL, CLERK_ISSUER, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
console.log("Derived issuer:", issuer);
