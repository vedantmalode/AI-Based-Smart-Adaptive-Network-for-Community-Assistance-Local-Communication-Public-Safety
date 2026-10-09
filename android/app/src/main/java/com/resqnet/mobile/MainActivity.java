package com.resqnet.mobile;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;

import java.util.ArrayList;

public final class MainActivity extends Activity {
    // Request codes keep microphone and Bluetooth permission responses separate.
    private static final int PERMISSION_REQUEST = 4102;
    private static final int VOICE_PERMISSION_REQUEST = 4103;
    private WebView webView;
    private OfflineSpeechInput offlineSpeechInput;
    private SpeechRecognizer systemSpeechRecognizer;
    private PermissionRequest pendingWebPermissionRequest;
    private String pendingVoiceLanguage = "en";
    private boolean startMeshAfterPermission = false;
    private static MainActivity activeActivity;

    /** Builds the WebView shell and connects the JavaScript app to native features. */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeActivity = this;
        offlineSpeechInput = new OfflineSpeechInput(this);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean requestsAudio = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) requestsAudio = true;
                    }
                    if (!requestsAudio) {
                        request.deny();
                        return;
                    }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingWebPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, VOICE_PERMISSION_REQUEST);
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingWebPermissionRequest == request) pendingWebPermissionRequest = null;
            }
        });
        webView.addJavascriptInterface(new ResQNetBridge(), "ResQNetNative");
        setContentView(webView);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    /** Releases active media, permission requests, and WebView resources. */
    @Override
    protected void onDestroy() {
        if (activeActivity == this) activeActivity = null;
        if (offlineSpeechInput != null) offlineSpeechInput.release();
        destroySystemSpeechRecognizer();
        if (pendingWebPermissionRequest != null) {
            pendingWebPermissionRequest.deny();
            pendingWebPermissionRequest = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("ResQNetNative");
            webView.destroy();
        }
        super.onDestroy();
    }

    /** Lets Android's back button navigate within the WebView when possible. */
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    /** Returns whether this Android version has all permissions needed for BLE. */
    private boolean hasBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
                    && checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED
                    && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Requests the Bluetooth permissions required by this Android version. */
    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            String[] permissions = Build.VERSION.SDK_INT >= 33
                    ? new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE,
                    Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.POST_NOTIFICATIONS}
                    : new String[]{Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE,
                    Manifest.permission.BLUETOOTH_CONNECT};
            requestPermissions(permissions, PERMISSION_REQUEST);
        } else {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, PERMISSION_REQUEST);
        }
    }

    /** Combines current BLE status with an optional user-facing error. */
    private JSONObject meshStatus(String error) {
        JSONObject result = BleMeshService.getStatus(this);
        try { if (error != null) result.put("error", error); }
        catch (Exception ignored) { }
        return result;
    }

    /** Starts the foreground BLE service after checking permissions and Bluetooth. */
    private void startMeshService() {
        if (!hasBluetoothPermissions()) {
            requestBluetoothPermissions();
            return;
        }
        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            dispatchMeshStatus("Turn on Bluetooth to start the nearby volunteer relay.");
            return;
        }
        Intent service = new Intent(this, BleMeshService.class);
        service.setAction(BleMeshService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
        else startService(service);
    }

    /** Sends current mesh state to the web app as a browser event. */
    private void dispatchMeshStatus(String error) {
        JSONObject result = meshStatus(error);
        dispatchJavascript("window.dispatchEvent(new CustomEvent('resqnet:ble-status',{detail:" + result + "}));");
    }

    /** Delivers a relayed incident to the active JavaScript application. */
    static void dispatchRelayedIncident(JSONObject incident) {
        MainActivity activity = activeActivity;
        if (activity == null || activity.webView == null) return;
        String detail = JSONObject.quote(incident.toString());
        activity.runOnUiThread(() -> activity.webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('resqnet:incident',{detail:JSON.parse(" + detail + ")}));", null));
    }

    /** Delivers a relayed community message to the active JavaScript application. */
    static void dispatchRelayedCommunityMessage(JSONObject message) {
        MainActivity activity = activeActivity;
        if (activity == null || activity.webView == null) return;
        String detail = JSONObject.quote(message.toString());
        activity.runOnUiThread(() -> activity.webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('resqnet:community-message',{detail:JSON.parse(" + detail + ")}));", null));
    }

    /** Refreshes BLE state after the background service changes. */
    static void dispatchBleStatus(String error) {
        MainActivity activity = activeActivity;
        if (activity == null || activity.webView == null) return;
        JSONObject status = activity.meshStatus(error);
        activity.dispatchJavascript("window.dispatchEvent(new CustomEvent('resqnet:ble-status',{detail:" + status + "}));");
    }

    /** Runs a JavaScript statement safely on Android's UI thread. */
    private void dispatchJavascript(String script) {
        if (webView == null) return;
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    /** Handles microphone and nearby-device permission results. */
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == VOICE_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingWebPermissionRequest != null) {
                PermissionRequest request = pendingWebPermissionRequest;
                pendingWebPermissionRequest = null;
                if (granted) request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                else request.deny();
            } else if (granted) startVoiceInputForLanguage(pendingVoiceLanguage);
            else dispatchVoiceState("error", "Microphone permission is needed for offline voice input.", 0);
            return;
        }
        if (requestCode != PERMISSION_REQUEST) return;
        boolean granted = hasBluetoothPermissions();
        if (startMeshAfterPermission && granted) startMeshService();
        startMeshAfterPermission = false;
        if (!granted) dispatchMeshStatus("Nearby device permissions are required to relay SOS reports.");
    }

    /** Uses the downloaded on-device recognizer for English and Hindi. */
    private void startOfflineVoiceInput(String language) {
        if (offlineSpeechInput == null) offlineSpeechInput = new OfflineSpeechInput(this);
        offlineSpeechInput.start(language, new OfflineSpeechInput.Listener() {
            @Override public void onState(String state, String message, int percent) { dispatchVoiceState(state, message, percent); }
            @Override public void onText(String text) { dispatchVoiceText(text); }
        });
    }

    /** Chooses offline English/Hindi or the installed system Marathi recognizer. */
    private void startVoiceInputForLanguage(String language) {
        if ("mr".equals(language)) {
            startSystemVoiceInput("mr-IN");
            return;
        }
        startOfflineVoiceInput(language);
    }

    /** Starts Marathi transcription through the Android speech recognition service. */
    private void startSystemVoiceInput(String locale) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            dispatchVoiceState("error", "Marathi speech service is unavailable on this device. You can type the emergency details instead.", 0);
            return;
        }
        destroySystemSpeechRecognizer();
        try {
            systemSpeechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            systemSpeechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { dispatchVoiceState("listening", "Listening in Marathi…", 0); }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { dispatchVoiceState("processing", "Processing speech…", 0); }
                @Override public void onError(int error) {
                    destroySystemSpeechRecognizer();
                    dispatchVoiceState("error", "Marathi speech recognition failed. You can try again or type the details.", 0);
                }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) dispatchVoiceText(matches.get(0));
                    destroySystemSpeechRecognizer();
                    dispatchVoiceState("idle", "Voice input complete.", 0);
                }
                @Override public void onPartialResults(Bundle partialResults) {
                    ArrayList<String> matches = partialResults == null ? null : partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) dispatchVoiceText(matches.get(0));
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            systemSpeechRecognizer.startListening(intent);
            dispatchVoiceState("listening", "Starting Marathi speech recognition…", 0);
        } catch (Exception error) {
            destroySystemSpeechRecognizer();
            dispatchVoiceState("error", "Could not start Marathi speech recognition. You can type the details instead.", 0);
        }
    }

    /** Stops and releases the system speech recognizer if one is active. */
    private void destroySystemSpeechRecognizer() {
        if (systemSpeechRecognizer != null) {
            systemSpeechRecognizer.cancel();
            systemSpeechRecognizer.destroy();
            systemSpeechRecognizer = null;
        }
    }

    /** Converts native speech state into an event consumed by the web UI. */
    private void dispatchVoiceState(String state, String message, int percent) {
        JSONObject event = new JSONObject();
        try { event.put("state", state); event.put("message", message); event.put("percent", percent); }
        catch (Exception ignored) { }
        dispatchJavascript("window.dispatchEvent(new CustomEvent('resqnet:voice-state',{detail:" + event + "}));");
    }

    /** Sends recognized words to the report description field in the web UI. */
    private void dispatchVoiceText(String text) {
        dispatchJavascript("window.dispatchEvent(new CustomEvent('resqnet:voice-text',{detail:" + JSONObject.quote(text) + "}));");
    }

    /** JavaScript interface for local incidents, BLE, messaging, and voice. */
    private final class ResQNetBridge {
        /** Returns incidents cached by the Android app's local store. */
        @JavascriptInterface
        public String getIncidents() {
            try { return IncidentStore.read(MainActivity.this).toString(); }
            catch (Exception error) { return "[]"; }
        }

        /** Saves an incident locally and adds it to the nearby BLE relay queue. */
        @JavascriptInterface
        public String saveIncident(String json) {
            try {
                JSONObject saved = IncidentStore.upsert(MainActivity.this, new JSONObject(json));
                BleMeshService.queueRelay(MainActivity.this, saved);
                return saved.toString();
            } catch (Exception error) {
                JSONObject result = new JSONObject();
                try { result.put("error", error.getMessage()); }
                catch (Exception ignored) {}
                return result.toString();
            }
        }

        /** Returns messages stored on this Android device. */
        @JavascriptInterface
        public String getCommunityMessages() {
            try { return CommunityMessageStore.read(MainActivity.this).toString(); }
            catch (Exception error) { return "[]"; }
        }

        /** Saves and queues a community message for nearby BLE delivery. */
        @JavascriptInterface
        public String sendCommunityMessage(String json) {
            try {
                JSONObject message = new JSONObject(json);
                CommunityMessageStore.upsert(MainActivity.this, message);
                BleMeshService.queueCommunityMessage(MainActivity.this, message);
                JSONObject response = new JSONObject();
                response.put("queued", true);
                response.put("id", message.optString("id"));
                return response.toString();
            } catch (Exception error) {
                JSONObject response = new JSONObject();
                try { response.put("error", error.getMessage()); }
                catch (Exception ignored) { }
                return response.toString();
            }
        }

        /** Starts the nearby relay service, requesting permissions if necessary. */
        @JavascriptInterface
        public String startBleMesh() {
            if (!hasBluetoothPermissions()) {
                startMeshAfterPermission = true;
                requestBluetoothPermissions();
                return meshStatus("Allow Nearby devices permission to start the volunteer relay.").toString();
            }
            startMeshService();
            return meshStatus(null).toString();
        }

        /** Stops the foreground nearby relay service. */
        @JavascriptInterface
        public String stopBleMesh() {
            stopService(new Intent(MainActivity.this, BleMeshService.class));
            return meshStatus(null).toString();
        }

        /** Returns the relay status snapshot to JavaScript. */
        @JavascriptInterface
        public String bleStatus() { return meshStatus(null).toString(); }

        /** Marks a message delivered after the server confirms it received the report. */
        @JavascriptInterface
        public String markServerConfirmed(String messageId) {
            BleMeshService.markServerConfirmed(MainActivity.this, messageId);
            return meshStatus(null).toString();
        }

        /** Starts voice recognition after checking microphone permission. */
        @JavascriptInterface
        public String startVoiceInput(String languageCode) {
            pendingVoiceLanguage = languageCode == null ? "en" : languageCode;
            runOnUiThread(() -> {
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, VOICE_PERMISSION_REQUEST);
                } else startVoiceInputForLanguage(pendingVoiceLanguage);
            });
            return "requested";
        }

        /** Stops both speech engines and notifies the web app. */
        @JavascriptInterface
        public String stopVoiceInput() {
            runOnUiThread(() -> {
                if (offlineSpeechInput != null) offlineSpeechInput.stop();
                destroySystemSpeechRecognizer();
                dispatchVoiceState("idle", "Voice input stopped.", 0);
            });
            return "stopped";
        }
    }
}
