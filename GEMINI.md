# VibeNotes Development & Release Guidelines

This document outlines standard procedures for maintaining and releasing new versions of VibeNotes.

---

## How to Release a New Version

When releasing a new version of VibeNotes (e.g., `v0.3.3`), follow this strict workflow to ensure the Tauri v2 in-app auto-updater and GitHub Actions release pipelines succeed:

### 1. Synchronize Version Numbers Across All 3 Files
The version must be identical in all three locations:

- **`package.json`**:
  ```json
  "version": "X.Y.Z"
  ```
- **`src-tauri/tauri.conf.json`**:
  ```json
  "version": "X.Y.Z"
  ```
- **`src-tauri/Cargo.toml`**:
  ```toml
  version = "X.Y.Z"
  ```

> [!CRITICAL]
> **Git Tag Must Match `tauri.conf.json` Version Exactly**:
> `tauri-action` will fail the CI/CD build if the Git tag (e.g. `v0.3.3`) does not match the version defined in `tauri.conf.json` (`0.3.3`).

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

### 4. Build Verification (Optional Local Sanity Check)
```bash
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
1. Builds the Windows binaries (`.exe`, `.msi`).
2. Signs the update package using `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_KEY_PASSWORD`.
3. Generates `latest.json` containing the new version manifest.
4. Publishes all assets directly to the GitHub Release.
