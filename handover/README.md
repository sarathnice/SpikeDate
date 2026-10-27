# Encrypted credential handover

Only `spikedate-credentials.json.gpg` may contain credential material here, and
only after encryption and local decryption verification. **The owner-encrypted
vault was created and recovery-verified on October 27, 2026.** Five available
local inputs matched their recovered bytes and SHA-256 checksums. The Cloudflare
deployment token and supplemental owner/provider notes were unavailable and are
not included. This is an incomplete owner-controlled backup, not a
replacement for GitHub Actions environment secrets or individual account access.

## Create a replacement on the owner's computer

The creation tool refuses to overwrite an existing vault. Preserve the previous
ciphertext outside this path before creating a replacement; do not delete your
only recovery copy. The verification plaintext was removed after checks; decrypt
again when you need to recover the files.

1. Review the ignored explicit input list at
   `outputs/private-handover/inputs.json`. Add only SpikeDate-specific files you
   intend to share. Never add personal Apple/Google/GitHub passwords, MFA recovery
   codes, a Cloudflare Global API Key, session cookies or a Wrangler OAuth token.
2. Run `node scripts/credential-vault.mjs inspect`. It lists names only, not values.
   Missing Cloudflare or other provider secrets must not be assumed backed up.
   GitHub's settings/API do not reveal saved secret values; this tool does not
   export them through a workflow or rotate credentials.
3. Run `node scripts/credential-vault.mjs encrypt`. GnuPG asks for a passphrase
   locally. Use a unique long random passphrase held in a password manager. Do
   not put it in chat, a command argument, source, README or this repository's
   Actions secrets. Lost passphrases cannot be recovered by this tool.
4. Run `node scripts/credential-vault.mjs decrypt`. The file is authenticated by
   GnuPG, then embedded file SHA-256 checksums are checked. Decrypted JSON is
   written only to `outputs/private-handover/decrypted-vault.json` (ignored).
   Each `files` entry contains a name and base64 file bytes. Base64 inside this
   **decrypted** JSON is not encryption. View it privately; never upload it.
5. Review `missing` and the contents privately. Once verified, commit only:

   ```powershell
   git add -- handover/spikedate-credentials.json.gpg
   git commit -m "Add owner-approved encrypted credential handover"
   git push origin codex/staging-mobile
   ```

The tool uses installed GnuPG, AES256 symmetric encryption and its password
dialog, not a custom cipher/password screen. On this Windows PC it finds Git's
bundled GPG. On another machine install GnuPG or set `SPIKEDATE_GPG_PATH` to its
executable. GPG uses a private local home under ignored `outputs/`.
Encryption reads only explicit files into memory and does not write a plaintext
archive. Decryption deliberately writes plaintext for local recovery, and that
file (plus existing source credential files) may be synced by OneDrive or captured
by local backups. Protect the device and storage accordingly. Memory wiping is
best-effort in a managed runtime, not a guarantee against host compromise.

## Share and rotate safely

- A recipient needs both the encrypted file and its passphrase. Send them via
  separate secure channels; do not share an owner-level bundle with every developer.
- Prefer separate per-developer access and limited deployment credentials.
- Git history retains old encrypted versions. If any included key/passphrase is
  compromised or a developer leaves, rotate affected provider credentials;
  changing only the archive password does not revoke previous copies/access.
- Keep an offline encrypted recovery copy. A password-encrypted file in Git still
  allows offline password guessing and is not a substitute for a strong password.
- This archive is not used/decrypted by CI. The existing encrypted GitHub staging
  secrets continue to power Cloudflare and TestFlight releases.

References: [GitHub's GPG-encrypted file guidance](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#storing-large-secrets).
