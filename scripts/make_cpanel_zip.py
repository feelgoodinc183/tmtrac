#!/usr/bin/env python3
import os
import sys
import zipfile
import json
import shutil

ROOT_DIR = os.path.abspath(os.path.dirname(__file__) + '/..')
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')

if not os.path.exists(DIST_DIR):
    print("Error: dist directory does not exist. Run 'npm run build' first.")
    sys.exit(1)

# Ensure public dir exists
os.makedirs(PUBLIC_DIR, exist_ok=True)

# 1. Create minimal production package.json for cPanel
prod_package_json = {
    "name": "tmtrac",
    "version": "1.0.0",
    "private": True,
    "description": "TMTRAC - LoRa Mesh Marine Regatta & Offshore Race Management System for tmtrac.my",
    "main": "app.js",
    "scripts": {
        "start": "node app.js"
    },
    "dependencies": {
        "dotenv": "^17.2.3",
        "express": "^4.21.2",
        "mqtt": "^5.15.2",
        "stripe": "^17.7.0",
        "ws": "^8.21.3"
    },
    "optionalDependencies": {
        "better-sqlite3": "^11.8.1"
    }
}

prod_pkg_path = os.path.join(ROOT_DIR, 'dist', 'production-package.json')
with open(prod_pkg_path, 'w') as f:
    json.dump(prod_package_json, f, indent=2)

# 2. Build tmtrac-cpanel-deployment.zip (Full-Stack Node.js app for cPanel "Setup Node.js App")
fullstack_zip_name = 'tmtrac-cpanel-deployment.zip'
fullstack_zip_path = os.path.join(ROOT_DIR, fullstack_zip_name)

print(f"Creating {fullstack_zip_name}...")
with zipfile.ZipFile(fullstack_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    # app.js
    app_js_path = os.path.join(ROOT_DIR, 'app.js')
    if os.path.exists(app_js_path):
        z.write(app_js_path, 'app.js')
    
    # package.json
    z.write(prod_pkg_path, 'package.json')
    
    # .htaccess
    htaccess_path = os.path.join(PUBLIC_DIR, '.htaccess')
    if os.path.exists(htaccess_path):
        z.write(htaccess_path, '.htaccess')
    
    # Guide & env
    guide_path = os.path.join(ROOT_DIR, 'CPANEL_DEPLOYMENT_GUIDE.md')
    if os.path.exists(guide_path):
        z.write(guide_path, 'CPANEL_DEPLOYMENT_GUIDE.md')
        z.write(guide_path, 'README.md')
    
    env_example = os.path.join(ROOT_DIR, '.env.example')
    if os.path.exists(env_example):
        z.write(env_example, '.env.example')
        z.write(env_example, '.env')

    # dist contents
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            if file == 'production-package.json' or file.endswith('.zip'):
                continue
            abs_f = os.path.join(root, file)
            rel_f = os.path.relpath(abs_f, ROOT_DIR)
            z.write(abs_f, rel_f)

    # data directory (pre-seeded with packages, users, and super admin)
    data_dir = os.path.join(ROOT_DIR, 'data')
    if os.path.exists(data_dir):
        for data_file in os.listdir(data_dir):
            if data_file.endswith('.json') or data_file.endswith('.db'):
                abs_df = os.path.join(data_dir, data_file)
                z.write(abs_df, os.path.join('data', data_file))

    # restart.php helper
    restart_php_path = os.path.join(PUBLIC_DIR, 'restart.php')
    if os.path.exists(restart_php_path):
        z.write(restart_php_path, 'restart.php')

    # Automatic Phusion Passenger reload trigger
    import time
    restart_stamp = f"Restart requested at {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\n"
    z.writestr('tmp/restart.txt', restart_stamp)

print(f"Saved {fullstack_zip_name} ({os.path.getsize(fullstack_zip_path)} bytes)")

# 3. Build tmtrac-public_html.zip (Direct static upload for public_html)
static_zip_name = 'tmtrac-public_html.zip'
static_zip_path = os.path.join(ROOT_DIR, static_zip_name)

print(f"Creating {static_zip_name}...")
with zipfile.ZipFile(static_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            if file == 'production-package.json' or file.startswith('server.cjs') or file.endswith('.zip'):
                continue
            abs_f = os.path.join(root, file)
            rel_f = os.path.relpath(abs_f, DIST_DIR)
            z.write(abs_f, rel_f)
            
    if os.path.exists(htaccess_path) and '.htaccess' not in z.namelist():
        z.write(htaccess_path, '.htaccess')
    if os.path.exists(guide_path):
        z.write(guide_path, 'CPANEL_DEPLOYMENT_GUIDE.md')
        z.write(guide_path, 'README.md')

print(f"Saved {static_zip_name} ({os.path.getsize(static_zip_path)} bytes)")

# 4. Build tmtrac-update-only.zip (Fast 60-second update: only dist/ and app.js)
update_zip_name = 'tmtrac-update-only.zip'
update_zip_path = os.path.join(ROOT_DIR, update_zip_name)

print(f"Creating {update_zip_name}...")
with zipfile.ZipFile(update_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    if os.path.exists(app_js_path):
        z.write(app_js_path, 'app.js')
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            if file == 'production-package.json' or file.endswith('.zip'):
                continue
            abs_f = os.path.join(root, file)
            rel_f = os.path.relpath(abs_f, ROOT_DIR)
            z.write(abs_f, rel_f)
    if os.path.exists(data_dir):
        for data_file in os.listdir(data_dir):
            if data_file.endswith('.json') or data_file.endswith('.db'):
                abs_df = os.path.join(data_dir, data_file)
                z.write(abs_df, os.path.join('data', data_file))

    if os.path.exists(restart_php_path):
        z.write(restart_php_path, 'restart.php')

    # Automatic Phusion Passenger reload trigger
    z.writestr('tmp/restart.txt', restart_stamp)

print(f"Saved {update_zip_name} ({os.path.getsize(update_zip_path)} bytes)")

# 5. Copy zip files to public/ and dist/ so user can download directly via URL
for zip_file, path in [(fullstack_zip_name, fullstack_zip_path), (static_zip_name, static_zip_path), (update_zip_name, update_zip_path)]:
    shutil.copy(path, os.path.join(PUBLIC_DIR, zip_file))
    shutil.copy(path, os.path.join(DIST_DIR, zip_file))

print("All deployment zip archives successfully created and placed in root, public/, and dist/!")

