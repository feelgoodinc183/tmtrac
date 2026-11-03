# Fix Production Path Mismatch: Enforce tmtrac.db, Auto-Archive regatta.db, and Trigger Passenger Reload

## Summary
Resolve the discrepancy where the production cPanel runtime path was still reporting `.../data/regatta.db` instead of the authoritative `.../data/tmtrac.db`. Strictly eliminate all legacy references to `regatta.db`, sanitize configured path strings (handling quotes and path variations), auto-archive legacy files in both configured and standard directories, and include a Passenger reload trigger (`tmp/restart.txt`) in deployment archives.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following decisions:
> - **Confirmed Action 1**: Always override `regatta.db` to `tmtrac.db` and auto-archive `regatta.db` with a timestamped backup, even if `regatta.db` is explicitly declared in production `.env`.
> - **Confirmed Action 2**: Ensure the updated code and build are packaged with an automatic Passenger restart mechanism (`tmp/restart.txt`) so cPanel reloads the new process immediately upon extraction.

---

## 1. Root Cause Analysis

1. **Quote & Substring Matching in `determineEffectiveDbPath()`**:
   - In `.env` on cPanel, `SQLITE_DB_PATH="/home/tmtecq00/public_html/tmtrac.my/data/regatta.db"` may contain surrounding quotes or trailing whitespace.
   - Exact basename matching (`path.basename(configured) === 'regatta.db'`) failed when quotes (`"regatta.db"`) or path variations were parsed directly from raw environment strings.
   - `DATA_DIR` was checking `./data/regatta.db` rather than the absolute directory specified in `SQLITE_DB_PATH` (`/home/tmtecq00/public_html/tmtrac.my/data/`).

2. **Passenger Process Caching**:
   - On Exabytes / cPanel Phusion Passenger, uploading files to `dist/` does not automatically recycle existing Node.js worker processes.
   - The server process continues running with the old code until `tmp/restart.txt` is updated or the "Restart" button is clicked in cPanel "Setup Node.js App".

---

## 2. Proposed Changes

### 1. Robust Path Sanitization & Absolute Archival (`src/server/db.ts`)
- Update `determineEffectiveDbPath()`:
  - Strip any surrounding quotes (`"`, `'`) and whitespace from `process.env.SQLITE_DB_PATH` and `process.env.DB_PATH`.
  - If the path contains `regatta.db` anywhere, replace it with `tmtrac.db`.
  - Resolve candidate directories: check both `DATA_DIR` and `path.dirname(configured)`.
  - If `regatta.db` exists in either location:
    - If `tmtrac.db` exists, rename/archive `regatta.db` to `regatta.db.archived.<timestamp>`.
    - If `tmtrac.db` does not exist, copy `regatta.db` to `tmtrac.db`, then rename `regatta.db` to `regatta.db.archived.<timestamp>`.
  - Enforce that `effectivePath` **NEVER** ends with `regatta.db` under any circumstance.

### 2. Update Self-Repair Routine (`src/server/db.ts`)
- In `repairDatabase()`:
  - Check both `DATA_DIR` and `path.dirname(dbDiagnosticsState.effectivePath)` for stray `regatta.db` files and archive them.
  - Flush WAL journal buffers via `PRAGMA wal_checkpoint(TRUNCATE)` and run `ANALYZE`.
  - Return clear diagnostic details verifying that `tmtrac.db` is the active file.

### 3. Add Automatic Passenger Restart Trigger (`scripts/make_cpanel_zip.py`)
- Automatically generate a fresh `tmp/restart.txt` inside `tmtrac-update-only.zip` and `tmtrac-cpanel-deployment.zip`.
- When unzipped in cPanel File Manager, Passenger immediately notices the new timestamp on `tmp/restart.txt` and automatically restarts the Node.js application.

### 4. Build & Deployment Artifact Regeneration
- Recompile with `npm run build` (`vite build`, `esbuild server.ts`, and `make_cpanel_zip.py`).
- Regenerate `tmtrac-update-only.zip`, `tmtrac-cpanel-deployment.zip`, and `tmtrac-public_html.zip`.

---

## 3. Verification Plan

### Automated Verification
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
- Run `compile_applet` to confirm successful build.
- Run `npm run build` to verify `tmp/restart.txt` is included in all zip archives.

### Manual Verification
- Test `determineEffectiveDbPath()` with test inputs (with quotes, without quotes, absolute paths pointing to `regatta.db`) to ensure it always resolves to `tmtrac.db`.
