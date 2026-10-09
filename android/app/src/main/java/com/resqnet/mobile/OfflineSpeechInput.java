package com.resqnet.mobile;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Downloads small English/Hindi Vosk models once, then recognizes speech on-device. */
final class OfflineSpeechInput {
    interface Listener {
        void onState(String state, String message, int percent);
        void onText(String text);
    }

    private static final String TAG = "ResQNetSpeech";
    private static final String MODEL_HOST = "https://alphacephei.com/vosk/models/";
    private static final long MAX_ARCHIVE_BYTES = 150L * 1024 * 1024;
    private static final long MAX_EXPANDED_BYTES = 250L * 1024 * 1024;
    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile SpeechService service;
    private volatile Model model;
    private volatile boolean closed;

    OfflineSpeechInput(Context context) { this.context = context.getApplicationContext(); }

    synchronized void start(String language, Listener listener) {
        if (service != null) {
            listener.onState("listening", "Listening offline…", 0);
            return;
        }
        final String modelName;
        if ("en".equals(language)) modelName = "vosk-model-small-en-us-0.15";
        else if ("hi".equals(language)) modelName = "vosk-model-small-hi-0.22";
        else {
            listener.onState("error", "Offline voice input currently supports English and Hindi.", 0);
            return;
        }
        closed = false;
        worker.execute(() -> {
            try {
                File modelDirectory = new File(context.getFilesDir(), modelName);
                if (!isInstalled(modelDirectory)) downloadAndInstall(modelName, listener);
                if (closed) return;
                listener.onState("loading", "Loading offline speech model…", 0);
                Model loaded = model;
                if (loaded == null) {
                    loaded = new Model(modelDirectory.getAbsolutePath());
                    model = loaded;
                }
                Model ready = loaded;
                main.post(() -> startService(ready, listener));
            } catch (Exception error) {
                Log.e(TAG, "Could not start offline speech recognition", error);
                listener.onState("error", error.getMessage() == null ? "Could not load the offline speech model." : error.getMessage(), 0);
            }
        });
    }

    private void startService(Model ready, Listener listener) {
        if (closed) return;
        try {
            Recognizer recognizer = new Recognizer(ready, 16000.0f);
            service = new SpeechService(recognizer, 16000.0f);
            service.startListening(new RecognitionListener() {
                @Override public void onPartialResult(String hypothesis) { }
                @Override public void onResult(String hypothesis) { emitText(hypothesis, listener); }
                @Override public void onFinalResult(String hypothesis) {
                    emitText(hypothesis, listener);
                    listener.onState("idle", "Voice input stopped.", 0);
                    service = null;
                }
                @Override public void onError(Exception error) {
                    Log.e(TAG, "Vosk recognition failed", error);
                    listener.onState("error", error.getMessage() == null ? "Speech recognition failed." : error.getMessage(), 0);
                    service = null;
                }
                @Override public void onTimeout() {
                    listener.onState("idle", "Voice input stopped.", 0);
                    service = null;
                }
            });
            listener.onState("listening", "Listening offline…", 0);
        } catch (Exception error) {
            listener.onState("error", error.getMessage() == null ? "Could not start the microphone." : error.getMessage(), 0);
        }
    }

    private void emitText(String hypothesis, Listener listener) {
        try {
            String text = new org.json.JSONObject(hypothesis).optString("text").trim();
            if (!text.isEmpty()) listener.onText(text);
        } catch (Exception ignored) { }
    }

    private void downloadAndInstall(String modelName, Listener listener) throws Exception {
        File zipFile = new File(context.getCacheDir(), modelName + ".zip");
        File staging = new File(context.getCacheDir(), modelName + "-staging");
        deleteTree(staging);
        HttpURLConnection connection = (HttpURLConnection) new URL(MODEL_HOST + modelName + ".zip").openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(true);
        try {
            connection.connect();
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300)
                throw new IllegalStateException("Speech model download failed (HTTP " + connection.getResponseCode() + ").");
            long contentLength = connection.getContentLengthLong();
            long downloaded = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(zipFile)) {
                byte[] buffer = new byte[16384];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    downloaded += read;
                    if (downloaded > MAX_ARCHIVE_BYTES) throw new IllegalStateException("Speech model archive is larger than expected.");
                    output.write(buffer, 0, read);
                    if (contentLength > 0) listener.onState("downloading", "Downloading offline speech model…", (int) Math.min(99, downloaded * 100 / contentLength));
                }
            }
            if (!staging.mkdirs() && !staging.isDirectory()) throw new IllegalStateException("Could not create speech model staging folder.");
            String root = staging.getCanonicalPath() + File.separator;
            long expanded = 0;
            try (ZipInputStream zip = new ZipInputStream(new java.io.FileInputStream(zipFile))) {
                ZipEntry entry;
                byte[] buffer = new byte[16384];
                while ((entry = zip.getNextEntry()) != null) {
                    File destination = new File(staging, entry.getName()).getCanonicalFile();
                    if (!destination.getPath().startsWith(root)) throw new IllegalStateException("Invalid speech model archive path.");
                    if (entry.isDirectory()) destination.mkdirs();
                    else {
                        File parent = destination.getParentFile();
                        if (parent != null && !parent.mkdirs() && !parent.isDirectory()) throw new IllegalStateException("Could not extract speech model.");
                        try (FileOutputStream output = new FileOutputStream(destination)) {
                            int read;
                            while ((read = zip.read(buffer)) != -1) {
                                expanded += read;
                                if (expanded > MAX_EXPANDED_BYTES) throw new IllegalStateException("Expanded speech model is larger than expected.");
                                output.write(buffer, 0, read);
                            }
                        }
                    }
                    zip.closeEntry();
                }
            }
            File extracted = new File(staging, modelName);
            if (!isInstalled(extracted)) throw new IllegalStateException("Speech model archive did not contain the expected files.");
            File installed = new File(context.getFilesDir(), modelName);
            deleteTree(installed);
            copyTree(extracted, installed);
            if (!isInstalled(installed)) throw new IllegalStateException("Could not install the speech model.");
            listener.onState("downloading", "Offline speech model ready.", 100);
        } finally {
            connection.disconnect();
            zipFile.delete();
            deleteTree(staging);
        }
    }

    private static boolean isInstalled(File directory) {
        File modelFile = new File(directory, "am/final.mdl");
        return directory.isDirectory() && modelFile.isFile();
    }

    private static void copyTree(File source, File target) throws Exception {
        if (source.isDirectory()) {
            if (!target.mkdirs() && !target.isDirectory()) throw new IllegalStateException("Could not install speech model files.");
            File[] children = source.listFiles();
            if (children != null) for (File child : children) copyTree(child, new File(target, child.getName()));
        } else {
            try (InputStream input = new java.io.FileInputStream(source); FileOutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[16384];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
        }
    }

    private static void deleteTree(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        if (file.exists()) file.delete();
    }

    synchronized void stop() {
        closed = true;
        if (service != null) service.stop();
        service = null;
    }

    synchronized void release() {
        stop();
        if (model != null) model.close();
        model = null;
        worker.shutdownNow();
    }
}
