package com.brandigail.apexvoice;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApexListeningPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * While a conversation is running, keep the web page's timers and audio going after the screen turns off or
     * the user switches apps; the foreground service is what makes this allowed.
     */
    @Override
    public void onPause() {
        super.onPause();
        if (ListeningService.running && getBridge() != null) {
            WebView webView = getBridge().getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
