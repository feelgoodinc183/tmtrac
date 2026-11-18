package my.tmtrac.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RelayPlugin.class);
        super.onCreate(savedInstanceState);

        // While tracking runs in the background, the web page sends positions to the race server.
        // Keep its renderer from being dropped first when Android needs memory.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView webView = getBridge().getWebView();
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
    }
}
