package com.brandigail.apexvoice;

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

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Keeps the app alive while a hands-free conversation is running. Android only lets an app use the microphone in
 * the background if a foreground service of type "microphone" is running, and that service must show a
 * notification so the user always knows Apex is listening.
 */
public class ListeningService extends Service {
    private static final String CHANNEL_ID = "apex_listening";
    private static final int NOTIFICATION_ID = 1001;
    /** Safety net: a conversation never needs the CPU held awake for longer than this. */
    private static final long MAX_WAKE_MS = 4L * 60 * 60 * 1000;

    /** True while the service is running; MainActivity uses it to keep the web page alive in the background. */
    static volatile boolean running = false;

    private PowerManager.WakeLock wakeLock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannel();
        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Apex is listening")
                .setContentText("Tap to open the conversation. End it in the app to stop listening.")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(tap)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ApexVoice:listening");
            wakeLock.acquire(MAX_WAKE_MS);
        }
        running = true;
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel =
                new NotificationChannel(CHANNEL_ID, "Hands-free listening", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while the Apex assistant is listening.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
}
