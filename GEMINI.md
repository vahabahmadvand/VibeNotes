# VibeNotes Development & Release Guidelines

This document outlines standard procedures for maintaining and releasing new versions of VibeNotes.

---

## How to Release a New Version

When releasing a new version of VibeNotes (e.g., `v0.3.3`), follow this strict workflow to ensure the Tauri v2 in-app auto-updater and GitHub Actions release pipelines succeed:

### 1. Synchronize Version Numbers (Automated)
Run the automated bump command to update all configuration and lock files simultaneously (`package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`):

```powershell
# Bump patch (e.g. 0.3.5 -> 0.3.6)
npm run bump patch

# OR bump minor (e.g. 0.3.5 -> 0.4.0)
npm run bump minor

# OR specify an exact version:
npm run bump 0.3.6
```

> [!NOTE]
> Frontend components (`NotesHub.tsx`, `UpdateModal.tsx`) use `__APP_VERSION__` dynamically injected by Vite at build time and `getVersion()` at runtime. They **never** require manual version editing.

> [!CRITICAL]
> **Git Tag Must Match `tauri.conf.json` Version Exactly**:
> `tauri-action` will fail the CI/CD build if the Git tag (e.g. `v0.3.6`) does not match the version defined in `tauri.conf.json` (`0.3.6`).

### 2. Verify Updater Configuration
Ensure `src-tauri/tauri.conf.json` retains:
```json
"bundle": {
  "active": true,
  "targets": "all",
  "createUpdaterArtifacts": true
}
```
`createUpdaterArtifacts: true` is required for Tauri v2 to generate `.sig` files and `latest.json`.

### 3. Verify App Version Permissions
In `src-tauri/capabilities/default.json`, ensure the following permissions remain enabled so the frontend can query `getVersion()` dynamically:
- `"core:app:default"`
- `"core:app:allow-version"`
- `"updater:default"`
- `"process:default"`

### 4. Build Verification & File Lock Prevention
Before building or verifying locally, ensure no running instance of `vibenotes.exe` is active (e.g. running in background or system tray), as Windows locks executable files with `Access is denied (os error 5)`:
```powershell
Stop-Process -Name "vibenotes" -Force -ErrorAction SilentlyContinue
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### 5. Commit, Tag, and Push
```bash
git add .
git commit -m "release: vX.Y.Z"
git tag vX.Y.Z
git push origin master --tags
```

### 6. Automated GitHub Actions
Pushing the `v*` tag triggers `.github/workflows/release.yml`, which:
1. Prepares and sanitizes the signing key (strips whitespace/quotes and ensures valid base64 padding).
2. Builds the Windows binaries (`.exe`, `.msi`).
3. Signs the update package using `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_KEY_PASSWORD`.
4. Generates `latest.json` containing the new version manifest.
5. Publishes all assets directly to the GitHub Release.

### 7. Troubleshooting & Key Invariants
- **Base64 Signing Key Padding (`Invalid padding`)**:
  - `TAURI_SIGNING_PRIVATE_KEY` must be a valid Base64 string whose length is a multiple of 4.
  - The `.github/workflows/release.yml` workflow includes a `Prepare Signing Key` step that automatically strips quotes/whitespace and appends any missing `=` padding characters.
- **Frontend Version Display Invariant**:
  - Never hardcode version strings (e.g. `v0.2.0`) in React components. Always use `getVersion()` from `@tauri-apps/api/app` backed by `"core:app:allow-version"` permissions in `src-tauri/capabilities/default.json`.
- **Tauri Custom Protocol Feature**:
  - In `src-tauri/Cargo.toml`, ensure `[features]` retains `default = ["custom-protocol"]` and `custom-protocol = ["tauri/custom-protocol"]`. Without this feature, Tauri treats builds as development mode and navigates to `localhost:5173`, resulting in `localhost refused to connect` errors when running standalone.
