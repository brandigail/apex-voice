package com.brandigail.apexvoice;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Lets the web app start and stop {@link ListeningService}, so the assistant keeps hearing with the screen off. */
@CapacitorPlugin(
        name = "ApexListening",
        permissions = {@Permission(strings = {Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")})
public class ApexListeningPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        // Android 14 refuses a microphone service unless the microphone permission is already granted.
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission is required before background listening can start.");
            return;
        }
        // The notification is how Android shows that Apex is listening; ask for it where it is a runtime permission.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void afterNotificationPermission(PluginCall call) {
        // Listening still works if the user declines; the notification is just hidden.
        startService(call);
    }

    private void startService(PluginCall call) {
        try {
            ContextCompat.startForegroundService(getContext(), new Intent(getContext(), ListeningService.class));
            call.resolve(new JSObject().put("running", true));
        } catch (RuntimeException e) {
            call.reject("Could not start background listening: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ListeningService.class));
        call.resolve(new JSObject().put("running", false));
    }
}
