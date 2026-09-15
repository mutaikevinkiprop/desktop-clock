/*
 * sign-windows.cjs — production Authenticode signing helper for Tauri bundling.
 *
 * Invoked by Tauri via `bundle.windows.signCommand`. Tauri appends the file
 * path(s) to sign as the final argument(s), and replaces `%1` if present.
 *
 * Signing identity is supplied by the PUBLISHER through environment variables
 * (never committed):
 *
 *   SIGN_CERT_THUMBPRINT  SHA-1 thumbprint of the code-signing cert installed
 *                         in the Windows certificate store (Best/My).
 *   SIGN_TIMESTAMP_URL     RFC3161 timestamp server (default: DigiCert).
 *   SIGN_DIGEST            signtool /fd algorithm (default: sha256).
 *   SIGN_CERT_SUBJECT      (optional) subject-name selector if thumbprint absent.
 *
 * Alternatively set SIGN_COMMAND to a fully custom command (e.g. Azure Trusted
 * Signing `trusted-signing-cli`).
 *
 * If NO signing identity is configured, the script exits 0 WITHOUT signing so
 * that unsigned development builds still complete. Production/Store builds MUST
 * provide an identity (see README / Store checklist).
 */
const { spawnSync } = require("child_process");

const files = process.argv.slice(2).filter(Boolean);

if (process.env.SIGN_COMMAND) {
  for (const f of files) {
    const cmd = process.env.SIGN_COMMAND.replace(/%1/g, f);
    const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  process.exit(0);
}

const thumbprint = process.env.SIGN_CERT_THUMBPRINT;
const subject = process.env.SIGN_CERT_SUBJECT;
const digest = process.env.SIGN_DIGEST || "sha256";
const timestampUrl =
  process.env.SIGN_TIMESTAMP_URL || "http://timestamp.digicert.com";

if (!thumbprint && !subject) {
  console.warn(
    "[sign-windows] No signing identity configured " +
      "(SIGN_CERT_THUMBPRINT / SIGN_CERT_SUBJECT). " +
      "Leaving artifact UNSIGNED. This is acceptable for local dev only.",
  );
  process.exit(0);
}

const selector = thumbprint
  ? ["/sha1", thumbprint]
  : ["/n", subject];

for (const f of files) {
  const args = [
    "sign",
    "/fd", digest,
    "/tr", timestampUrl,
    "/td", digest,
    "/a",
    ...selector,
    f,
  ];
  console.log(`[sign-windows] signtool ${args.join(" ")}`);
  const r = spawnSync("signtool", args, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`[sign-windows] signing failed for ${f}`);
    process.exit(r.status || 1);
  }
}
console.log("[sign-windows] all files signed.");
