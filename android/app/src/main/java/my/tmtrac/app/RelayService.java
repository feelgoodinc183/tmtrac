package my.tmtrac.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Keeps TMTRAC running while it relays a Meshtastic tracker over Bluetooth with the screen off.
 *
 * Android stops background apps after a while; a foreground service (with its notification) keeps
 * the app, its Bluetooth link and its connection to the race server alive. A partial wake lock
 * keeps the processor awake so tracker messages are passed on as they arrive. Phone GPS sharing
 * has its own service in the background-geolocation plugin.
 */
public class RelayService extends Service {

    static final String EXTRA_TEXT = "text";
    private static final String CHANNEL_ID = "tmtrac_relay";
    private static final int NOTIFICATION_ID = 7301;

    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = intent != null ? intent.getStringExtra(EXTRA_TEXT) : null;
        if (text == null || text.isEmpty()) text = "Passing tracker positions to the race server.";

        createChannel();
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("TMTRAC is relaying a tracker")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(tap)
            .build();

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE : 0;
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        } catch (Exception e) {
            // Android refuses when a required permission is missing; carry on without it
            stopSelf();
            return START_NOT_STICKY;
        }

        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tmtrac:relay");
            wakeLock.setReferenceCounted(false);
        }
        // Released in onDestroy; the timeout only guards against a service that is never stopped
        wakeLock.acquire(12 * 60 * 60 * 1000L);
        return START_NOT_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Tracker relay", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while TMTRAC relays a Bluetooth tracker");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
