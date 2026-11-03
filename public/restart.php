<?php
// TMTRAC cPanel Node.js / Phusion Passenger Restart Helper
// Accessible via https://tmtrac.my/restart.php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

$baseDir = dirname(__FILE__);
$tmpDir = $baseDir . '/tmp';
if (!file_exists($tmpDir)) {
    @mkdir($tmpDir, 0755, true);
}

// 1. Touch tmp/restart.txt to instruct Phusion Passenger to reload Node.js workers
$restartFile = $tmpDir . '/restart.txt';
$nowIso = date('c');
$touchSuccess = @file_put_contents($restartFile, "Restart triggered at " . $nowIso . " by restart.php\n");

// 2. Sanitize any legacy regatta.db in local .env if present
$envFile = $baseDir . '/.env';
$envFixed = false;
if (file_exists($envFile)) {
    $envContent = @file_get_contents($envFile);
    if ($envContent !== false && strpos($envContent, 'regatta.db') !== false) {
        $cleanEnv = str_replace('regatta.db', 'tmtrac.db', $envContent);
        if (@file_put_contents($envFile, $cleanEnv) !== false) {
            $envFixed = true;
        }
    }
}

// 3. Return JSON status
if ($touchSuccess !== false) {
    echo json_encode([
        'status' => 'success',
        'message' => 'Node.js restart signal successfully sent to Phusion Passenger.',
        'timestamp' => $nowIso,
        'restart_file' => $restartFile,
        'env_sanitized' => $envFixed ? 'Replaced legacy regatta.db with tmtrac.db in .env' : 'No changes needed in .env',
        'active_database' => '/home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db',
        'instruction' => 'Phusion Passenger will recycle the Node.js process on the next HTTP request. Please refresh https://tmtrac.my now.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
} else {
    echo json_encode([
        'status' => 'warning',
        'message' => 'Could not write to tmp/restart.txt automatically. Please open cPanel > Setup Node.js App and click the orange "Restart" button.',
        'timestamp' => $nowIso
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}
