package my.tmtrac.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Starts and stops {@link RelayService} from the web code (src/services/native/relayKeepAlive.ts). */
@CapacitorPlugin(
    name = "TmtracRelay",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class RelayPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        // Android 13+ hides the notification without this permission; the service runs either way
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void afterNotificationPermission(PluginCall call) {
        startService(call);
    }

    private void startService(PluginCall call) {
        Intent intent = new Intent(getContext(), RelayService.class);
        intent.putExtra(RelayService.EXTRA_TEXT, call.getString("text", ""));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not keep the relay running in the background: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), RelayService.class));
        call.resolve();
    }
}
