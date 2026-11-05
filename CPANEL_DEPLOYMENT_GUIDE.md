# TMTRAC Deployment Guide for Exabytes cPanel (tmtrac.my)

This package contains everything needed to deploy **TMTRAC** (LoRa Mesh Marine Regatta & Offshore Race Management System) on your **Exabytes cPanel shared hosting** server at:
**`/home/tmtecq00/public_html/tmtrac.my`** for **https://tmtrac.my**.

---

## 📋 Server Specification Summary

- **Hosting Provider**: Exabytes (Malaysia / Singapore CloudLinux with LiteSpeed Web Server)
- **Primary Domain**: `tmtrac.my` (also resolves `www.tmtrac.my` and `tmrac.my`)
- **Server Account**: `tmtecq00`
- **Application Root Directory**: `/home/tmtecq00/public_html/tmtrac.my`
- **Application Startup File**: `app.js`
- **Node.js Recommended Version**: `20.x` (or `18.x`)

---

## 🚀 Option 1 (Recommended): Exabytes "Setup Node.js App"

*Use this option to run the full-stack system with live real-time WebSockets, local SQLite persistence, user authentication, and multi-tenant regatta rooms.*

### Step 1: Create the Node.js Application in cPanel
1. Log in to your **Exabytes cPanel** dashboard (e.g. `https://tmtrac.my:2083` or your Exabytes server client area).
2. Scroll to the **Software** section and click **"Setup Node.js App"** (CloudLinux NodeJS Selector).
3. Click the blue **"Create Application"** button in the top-right.
4. Fill in the exact fields as follows:
   - **Node.js version**: Select `20.x` (e.g. 20.18.x / 20.20.x) or `18.x`
   - **Application mode**: `Production`
   - **Application root**: `public_html/tmtrac.my`
   - **Application URL**: `tmtrac.my` (choose `tmtrac.my` from the domain dropdown)
   - **Application startup file**: `app.js`
5. Click **"Create"**.
6. cPanel will start the environment and display the virtual environment command path at the top:
   ```bash
   source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate
   ```

---

### Step 2: Upload & Extract Files
1. Open cPanel **File Manager**.
2. Navigate to your project folder:
   **`/home/tmtecq00/public_html/tmtrac.my`**
3. Click **Upload** at the top toolbar and upload **`tmtrac-cpanel-deployment.zip`**.
4. Once the upload bar turns green (100%), return to File Manager.
5. Right-click **`tmtrac-cpanel-deployment.zip`** and click **"Extract"** (extract to `/home/tmtecq00/public_html/tmtrac.my`).
6. Confirm the files are placed directly in your folder:
   ```text
   /home/tmtecq00/public_html/tmtrac.my/
   ├── app.js                          (Passenger entry point)
   ├── package.json                    (Production dependencies)
   ├── .htaccess                       (LiteSpeed & HTTPS routing)
   ├── .env.example                    (Template: copy to .env on first install only)
   ├── CPANEL_DEPLOYMENT_GUIDE.md
   └── dist/
       ├── server.cjs                  (Production Express + WebSocket server)
       ├── index.html                  (Compiled React Single Page App)
       ├── robots.txt
       └── assets/                     (Hashed JS & CSS bundles)
   ```
   The zips never contain `.env` or `data/`, so extracting an update keeps the live settings and database.
   The server creates `data/` (database) on first start.

---

### Step 3: Install Dependencies
You can install dependencies in either of two ways:

#### Method A: Using cPanel Button (Simplest)
1. In cPanel, navigate back to **Software** > **Setup Node.js App**.
2. Click the edit pencil icon next to `tmtrac.my`.
3. Check that **Application startup file** says `app.js` and click **Save**.
4. If **"Run NPM Install"** is greyed out:
   - Refresh your browser page (F5) so cPanel re-reads `package.json`.
5. Click the **"Run NPM Install"** button and wait a few moments for completion.

#### Method B: Using cPanel Terminal / SSH
1. In cPanel, click **Terminal** (in the Advanced section).
2. Paste this single command and press Enter:
   ```bash
   source /home/tmtecq00/nodevenv/public_html/tmtrac.my/20/bin/activate && cd /home/tmtecq00/public_html/tmtrac.my && npm install --omit=dev
   ```

---

### Step 4: Restart & Test
1. In cPanel **Setup Node.js App**, click the orange **"Restart"** button.
2. Open your web browser and visit:
   👉 **https://tmtrac.my**
3. Your TMTRAC Regatta & Scoring system is now fully live!

---

## 🔄 Quick 60-Second Updates

Whenever you make updates in AI Studio and want to deploy the new code to your live server:

1. Download **`tmtrac-update-only.zip`** (or click "Download Fast Update" in the in-app Deployment Center).
2. Open cPanel **File Manager** and enter `/home/tmtecq00/public_html/tmtrac.my`.
3. Upload `tmtrac-update-only.zip` and click **Extract** to overwrite `dist/` and `app.js`.
4. Go to cPanel **Setup Node.js App** and click **"Restart"**.
5. Your updates are live immediately—no need to rerun `npm install`!

---

## ⚡ Option 2: Pure Static Deployment to `public_html/tmtrac.my`

*If you prefer to run TMTRAC as a client-side Single Page Application (browser-based GPS, Bluetooth mesh, spectator tracker) without the Node.js daemon:*

1. Open cPanel **File Manager** and enter `/home/tmtecq00/public_html/tmtrac.my`.
2. Upload **`tmtrac-public_html.zip`** and click **Extract**.
3. Verify that `index.html`, `.htaccess`, and the `assets/` folder are located in `/home/tmtecq00/public_html/tmtrac.my`.
4. The `.htaccess` file automatically routes all page URLs to `index.html` and enforces HTTPS.

---

## 🔒 Free SSL Certificate Setup on Exabytes

HTTPS is required by modern browsers for Web Bluetooth and Geolocation APIs:

1. In cPanel, open **SSL/TLS Status**.
2. Check the boxes for:
   - `tmtrac.my`
   - `www.tmtrac.my`
   - `tmrac.my` (if configured as alias)
3. Click **"Run AutoSSL"**.
4. Exabytes will automatically issue and install a Sectigo / Let's Encrypt SSL certificate within 2-5 minutes.

---

## 🔑 Super Admin Login
- **Username / Email**: `irsyadismail@gmail.com`
- **Password**: set `SUPER_ADMIN_PASSWORD` as an environment variable in cPanel **Setup Node.js App** before the first start. It is only used when the Super Admin account is first created; the server never resets an existing password. Without it, the account is created with a random password.
- **Existing installs**: the password stays whatever it currently is. Change it after deploying this version.
- **Access Level**: Full Super Admin (Multi-Tenant Organization Management, Event Creation, Database Backups)

---

## 📁 Recommended layout: app and data outside public_html

LiteSpeed serves any file under `public_html`, and cPanel rewrites `.htaccess` whenever the Node app's settings change, which silently removes blocking rules. Keeping the app and its data outside `public_html` makes them unreachable from the web no matter what `.htaccess` says:

```text
/home/tmtecq00/tmtrac-app/      application root (app.js, package.json, dist/, tmp/)
/home/tmtecq00/tmtrac-data/     DATA_DIR (tmtrac.db and its -wal/-shm files, backups)
/home/tmtecq00/public_html/tmtrac.my/   only cPanel's .htaccess for the domain
```

Environment variables in **Setup Node.js App**: `DATA_DIR=/home/tmtecq00/tmtrac-data`, `SQLITE_DB_PATH=/home/tmtecq00/tmtrac-data/tmtrac.db`, plus the Stripe and Gemini keys. With this layout, upload and extract update zips in `/home/tmtecq00/tmtrac-app`.

---

## 🗄️ Database: real SQLite on Node 22

On Node 22.13 or later the app uses Node's built-in SQLite (`data/tmtrac.db`). On older Node it falls back to the JSON store (`data/tmtrac_store.json`), as before. The log line `[SQLite DB] Using node-sqlite at ...` confirms which one is active.

**Switching an existing install to Node 22 (one time):**
1. Back up the whole `data/` folder (download it).
2. Deploy the latest update zip first, while still on the old Node version, and check the site works.
3. In **Setup Node.js App**, change the Node version to 22, click **Run NPM Install**, then **Restart**.
4. On first start the app imports `tmtrac_store.json` into SQLite in one step, renames the JSON file to `tmtrac_store.json.migrated-<date>` as a backup, and sets aside any old `tmtrac.db` as `tmtrac.db.pre-json-migration-<date>` (older deploy zips shipped a stale copy).
5. Sign in and check your rooms, users and PINs. Then re-check the 403 list below: changing the Node version rewrites the Passenger lines in `.htaccess`.

**Rolling back:** switch Node back to the old version, then rename `tmtrac_store.json.migrated-<date>` back to `tmtrac_store.json` and restart. Changes made while on SQLite are not in that file.

---

## 🔒 Keep the app folder private

The app folder is inside `public_html`, so LiteSpeed will serve any file in it unless `.htaccess` forbids it. The root `.htaccess` (from `deploy/root.htaccess`) blocks `data/`, `dist/`, `tmp/`, `node_modules/` and internal files such as `package.json`, `app.js`, logs and zips. After every install or update, check:

- `https://tmtrac.my/data/tmtrac_store.json` must return **403**
- `https://tmtrac.my/dist/server.cjs` must return **403**
- `https://tmtrac.my/server.cjs` and `https://tmtrac.my/server.cjs.map` must return **404** (the app itself refuses them, whatever the layout)
- There must be **no** `.htaccess` inside `dist/` (it would cancel the root rules for that folder)
- Delete uploaded zips and `stderr.log` copies you downloaded or moved

For stronger isolation, set `DATA_DIR` in **Setup Node.js App** to a folder outside `public_html` (for example `/home/tmtecq00/tmtrac-data`) and move `data/` there.

---

## 📡 Meshtastic MQTT bridge

The server connects to the Meshtastic MQTT broker for events that turn MQTT on (Hardware window → MQTT, or the Malaysia LoRa & MQTT window), decrypts packets with the event's channel keys and sends node updates to everyone viewing the event. Channel keys and broker passwords are stored in the event's row in SQLite and are never sent to browsers.

- **First deploy with the bridge:** it needs the `protobufjs` package on the server. Upload the full `tmtrac-cpanel-deployment.zip` (it carries the updated `package.json`), click **Run NPM Install**, then **Restart**. Update-only zips are fine after that.
- **Default broker:** `mqtts://mqtt.meshtastic.org:8883` (username `meshdev`). Override server-wide with the environment variables `MESHTASTIC_MQTT_URL`, `MESHTASTIC_MQTT_USERNAME` and `MESHTASTIC_MQTT_PASSWORD` in **Setup Node.js App**.
- **Other brokers:** an event can use its own broker only if its host name is on the server's approved list. Add host names, separated by commas, in the environment variable `MQTT_ALLOWED_BROKER_HOSTS` (for example `broker.myclub.my`). The server connects on the event's behalf, so it only ever connects to brokers you approve, on standard MQTT ports.
- **Limits:** at most 10 broker connections for the whole server (change with `MQTT_MAX_BROKER_CONNECTIONS`); messages over 4 KB and more than 50 node updates per second per event are dropped.
- **Outbound ports:** the server must be able to open an outgoing connection to the broker (port 8883, or 1883 for `mqtt://`). Some shared hosts block these. If the MQTT status says it can't reach the broker, ask Exabytes to allow outgoing TCP 8883 to `mqtt.meshtastic.org`, or use a broker that offers MQTT over WebSockets on port 443 (`wss://…`).
- **Idle shutdown:** Passenger may stop the app when nobody is using it. The bridge only runs while someone has an MQTT-enabled event open, and starts again when the next person opens it, so nothing needs to stay running.
- **Position precision:** on the public default key (LongFast, `AQ==`), Meshtastic only shares approximate positions (about ±0.7–3 km). For race tracking, put the trackers on a club channel with its own key and add that channel to the event.
- **Testing only:** `MQTT_ALLOW_ANY_BROKER=1` turns the approved list off (e.g. to test with `mqtt://127.0.0.1:1883`). Never set it in production.

## 🛠️ Troubleshooting & Database Path Notes

### Why did my server show `/data/regatta.db` instead of `tmtrac.db`?
On cPanel (Phusion Passenger / CloudLinux Node.js Selector), worker processes stay resident in RAM. When you upload new files via File Manager or extract a zip, **Passenger does not automatically terminate the running worker in memory**. The old worker continues running with the old code and cached environment variables from before the upload!

**How to fix immediately:**
1. **Option A (cPanel Interface):** Open cPanel > **Setup Node.js App** and click the orange **"Restart"** button.
2. **Option B (In-App Troubleshooter):** In TMTRAC, open **Super Admin > Troubleshooter** tab and click the red **"Restart Node Server"** button.

Extracting an update zip also restarts the app, because it carries a fresh `tmp/restart.txt`.

`restart.php` is no longer shipped: anyone could open it to restart the app, and it rewrote `.env`. If an older install still has `restart.php` in `/home/tmtecq00/public_html/tmtrac.my`, delete it.

Once recycled, the Active Runtime Database path will immediately display:
`/home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db`
and all package edits and event edits will save directly!

