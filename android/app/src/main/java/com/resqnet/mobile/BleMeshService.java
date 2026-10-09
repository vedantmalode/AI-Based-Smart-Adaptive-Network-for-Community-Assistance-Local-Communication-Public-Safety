package com.resqnet.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelUuid;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class BleMeshService extends Service {
    public static final String ACTION_START = "com.resqnet.mobile.START_MESH";
    public static final UUID SERVICE_UUID = UUID.fromString("5c4c2ea0-2e25-4a86-9a20-54c08f5b7a10");
    public static final UUID INCIDENT_CHARACTERISTIC_UUID = UUID.fromString("5c4c2ea1-2e25-4a86-9a20-54c08f5b7a10");
    public static final UUID ACK_CHARACTERISTIC_UUID = UUID.fromString("5c4c2ea2-2e25-4a86-9a20-54c08f5b7a10");
    private static final UUID CLIENT_CONFIGURATION_UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final String CHANNEL_ID = "resqnet-nearby-relay";
    private static final String PREFS = "resqnet_ble_mesh";
    private static final int NOTIFICATION_ID = 7182;
    private static final String SIGNING_KEY_ALIAS = "resqnet_ble_origin_v1";
    private static final long MESSAGE_LIFETIME_MS = 6 * 60 * 60 * 1000L;
    private static final int MAX_HOPS = 5;
    private static final int SEEN_ID_LIMIT = 5_000;
    private static final long ACK_RETRY_MS = 10_000L;
    private static final int MAX_RETRIES_PER_CONNECTION = 3;
    private static volatile boolean running = false;
    private static volatile BleMeshService currentService;
    private static final Set<String> activePeers = ConcurrentHashMap.newKeySet();

    private BluetoothAdapter adapter;
    private BluetoothLeScanner scanner;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, PeerConnection> connections = new ConcurrentHashMap<>();
    private final Map<String, Transfer> incomingTransfers = new HashMap<>();
    private final Runnable retryPendingPackets = new Runnable() {
        @Override public void run() {
            if (!running) return;
            for (PeerConnection peer : connections.values()) sendNext(peer.gatt);
            mainHandler.postDelayed(this, 5_000L);
        }
    };

    static boolean isRunning() { return running; }
    static int getPeerCount() { return activePeers.size(); }

    private static void prepareNewPacket(JSONObject packet) throws Exception {
        long createdAt = System.currentTimeMillis();
        packet.put("createdAtMs", createdAt);
        packet.put("expiresAtMs", createdAt + MESSAGE_LIFETIME_MS);
        packet.put("maxHops", MAX_HOPS);
        packet.put("ttl", MAX_HOPS);
        packet.put("hopCount", 0);
    }

    private static KeyPair signingKeyPair() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (!keyStore.containsAlias(SIGNING_KEY_ALIAS)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(SIGNING_KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                    .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .build());
            generator.generateKeyPair();
            keyStore.load(null);
        }
        return new KeyPair(keyStore.getCertificate(SIGNING_KEY_ALIAS).getPublicKey(),
                (java.security.PrivateKey) keyStore.getKey(SIGNING_KEY_ALIAS, null));
    }

    private static byte[] signingBytes(JSONObject packet) throws Exception {
        JSONObject content = packet.optJSONObject("incident");
        if (content == null) content = packet.optJSONObject("communityMessage");
        if (content == null) throw new IllegalArgumentException("Packet content is missing.");
        return (packet.optString("messageId") + "|" + packet.optLong("createdAtMs") + "|"
                + packet.optLong("expiresAtMs") + "|" + packet.optInt("maxHops") + "|" + content.toString())
                .getBytes(StandardCharsets.UTF_8);
    }

    private static boolean signPacket(JSONObject packet) {
        try {
            KeyPair keys = signingKeyPair();
            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(keys.getPrivate());
            signer.update(signingBytes(packet));
            packet.put("originPublicKey", Base64.getEncoder().encodeToString(keys.getPublic().getEncoded()));
            packet.put("originSignature", Base64.getEncoder().encodeToString(signer.sign()));
            return true;
        } catch (Exception error) { return false; }
    }

    private static boolean verifyPacketSignature(JSONObject packet) {
        try {
            byte[] encodedKey = Base64.getDecoder().decode(packet.optString("originPublicKey"));
            byte[] signatureBytes = Base64.getDecoder().decode(packet.optString("originSignature"));
            java.security.PublicKey publicKey = KeyFactory.getInstance("EC")
                    .generatePublic(new X509EncodedKeySpec(encodedKey));
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update(signingBytes(packet));
            return verifier.verify(signatureBytes);
        } catch (Exception ignored) { return false; }
    }

    private static String validatePacket(JSONObject packet) {
        if (!verifyPacketSignature(packet)) return "INVALID_SIGNATURE";
        long createdAt = packet.optLong("createdAtMs", 0);
        long expiresAt = packet.optLong("expiresAtMs", 0);
        long now = System.currentTimeMillis();
        int maxHops = packet.optInt("maxHops", 0);
        int ttl = packet.optInt("ttl", -1);
        int hopCount = packet.optInt("hopCount", -1);
        if (createdAt <= 0 || createdAt > now + 5 * 60 * 1000L || expiresAt <= createdAt
                || expiresAt - createdAt > MESSAGE_LIFETIME_MS || expiresAt <= now) return "EXPIRED";
        if (maxHops < 1 || maxHops > MAX_HOPS || ttl < 1 || ttl > maxHops
                || hopCount < 0 || hopCount >= maxHops || ttl + hopCount > maxHops) return "HOP_LIMIT_REACHED";
        return "VALID";
    }

    static void markServerConfirmed(Context context, String messageId) {
        if (messageId == null || messageId.trim().isEmpty()) return;
        updateDeliveryStatus(context, messageId, "SERVER_CONFIRMED");
        SharedPreferences preferences = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        JSONArray stored;
        try { stored = new JSONArray(preferences.getString("queue", "[]")); }
        catch (Exception ignored) { stored = new JSONArray(); }
        JSONArray remaining = new JSONArray();
        for (int index = 0; index < stored.length(); index++) {
            JSONObject packet = stored.optJSONObject(index);
            if (packet != null && !messageId.equals(packet.optString("messageId"))) remaining.put(packet);
        }
        preferences.edit().putString("queue", remaining.toString()).apply();
        if (currentService != null) currentService.dispatchPendingPackets();
    }

    private static JSONObject deliveryStore(Context context) {
        try { return new JSONObject(context.getSharedPreferences(PREFS, MODE_PRIVATE).getString("delivery", "{}")); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    private static JSONArray readDeliveryStatuses(Context context) throws Exception {
        JSONObject store = deliveryStore(context);
        List<JSONObject> entries = new ArrayList<>();
        java.util.Iterator<String> keys = store.keys();
        while (keys.hasNext()) {
            JSONObject entry = store.optJSONObject(keys.next());
            if (entry != null) entries.add(entry);
        }
        entries.sort((left, right) -> Long.compare(right.optLong("updatedAtMs"), left.optLong("updatedAtMs")));
        JSONArray result = new JSONArray();
        for (int index = 0; index < Math.min(10, entries.size()); index++) result.put(entries.get(index));
        return result;
    }

    private static int countDeliveryStatuses(Context context, String targetStatus) {
        JSONObject store = deliveryStore(context);
        int count = 0;
        java.util.Iterator<String> keys = store.keys();
        while (keys.hasNext()) {
            JSONObject entry = store.optJSONObject(keys.next());
            if (entry != null && targetStatus.equals(entry.optString("status"))) count++;
        }
        return count;
    }

    private static void updateDeliveryStatus(Context context, String messageId, String status) {
        synchronized (BleMeshService.class) {
            JSONObject store = deliveryStore(context);
            JSONObject entry = new JSONObject();
            try {
                entry.put("messageId", messageId);
                entry.put("status", status);
                entry.put("updatedAtMs", System.currentTimeMillis());
                store.put(messageId, entry);
                while (store.length() > 500) store.remove(store.keys().next());
                context.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString("delivery", store.toString()).apply();
            } catch (Exception ignored) { }
        }
        if (currentService != null) MainActivity.dispatchBleStatus(null);
    }

    static JSONObject getStatus(Context context) {
        JSONObject status = new JSONObject();
        try {
            JSONArray queue = queuedPackets(context);
            SharedPreferences preferences = context.getSharedPreferences(PREFS, MODE_PRIVATE);
            status.put("running", running);
            status.put("peerCount", activePeers.size());
            status.put("queuedPackets", queue.length());
            status.put("sentFrames", preferences.getInt("sentFrames", 0));
            status.put("receivedPackets", preferences.getInt("receivedPackets", 0));
            status.put("serverConfirmedPackets", countDeliveryStatuses(context, "SERVER_CONFIRMED"));
            status.put("relayedPackets", countDeliveryStatuses(context, "RELAYED"));
            status.put("pendingPackets", countDeliveryStatuses(context, "PENDING"));
            status.put("deliveryStatuses", readDeliveryStatuses(context));
            status.put("lastEvent", preferences.getString("lastEvent", ""));
            status.put("lastEventAt", preferences.getLong("lastEventAt", 0));
        } catch (Exception ignored) { }
        return status;
    }

    private void recordMetric(String counter, String event) {
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        preferences.edit()
                .putInt(counter, preferences.getInt(counter, 0) + 1)
                .putString("lastEvent", event)
                .putLong("lastEventAt", System.currentTimeMillis())
                .apply();
        MainActivity.dispatchBleStatus(null);
    }

    private void recordActivity(String event) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("lastEvent", event)
                .putLong("lastEventAt", System.currentTimeMillis())
                .apply();
        MainActivity.dispatchBleStatus(null);
    }

    static void queueRelay(Context context, JSONObject incident) {
        try {
            JSONObject relayIncident = new JSONObject();
            relayIncident.put("id", incident.optString("id"));
            relayIncident.put("clientUuid", incident.optString("clientUuid"));
            relayIncident.put("category", incident.optString("category"));
            relayIncident.put("title", incident.optString("title").substring(0, Math.min(180, incident.optString("title").length())));
            String description = incident.optString("description");
            relayIncident.put("description", description.substring(0, Math.min(600, description.length())));
            relayIncident.put("peopleAffected", incident.optInt("peopleAffected", 1));
            relayIncident.put("peopleAffectedKnown", incident.optBoolean("peopleAffectedKnown", true));
            relayIncident.put("injuries", incident.optBoolean("injuries"));
            relayIncident.put("trapped", incident.optBoolean("trapped"));
            relayIncident.put("firePresent", incident.optBoolean("firePresent"));
            relayIncident.put("severity", incident.optString("severity", "MEDIUM"));
            relayIncident.put("priorityScore", incident.optInt("priorityScore", 50));
            relayIncident.put("confidence", incident.optDouble("confidence", 0.75));
            relayIncident.put("reportedAt", incident.optString("reportedAt"));
            relayIncident.put("reporterName", incident.optString("reporterName", "Citizen"));
            relayIncident.put("location", incident.optJSONObject("location") == null ? new JSONObject() : incident.optJSONObject("location"));
            relayIncident.put("assignedVolunteers", new JSONArray());
            relayIncident.put("assignedResources", new JSONArray());
            relayIncident.put("auditTimeline", incident.optJSONArray("auditTimeline") == null ? new JSONArray() : incident.optJSONArray("auditTimeline"));

            JSONObject packet = new JSONObject();
            String messageId = incident.optString("clientUuid");
            if (messageId.isEmpty()) messageId = incident.optString("id");
            if (messageId.isEmpty()) messageId = UUID.randomUUID().toString();
            relayIncident.put("clientUuid", messageId);
            packet.put("messageId", messageId);
            packet.put("incident", relayIncident);
            prepareNewPacket(packet);
            if (signPacket(packet)) appendPacket(context, packet);
        } catch (Exception ignored) {}
    }

    static void queueCommunityMessage(Context context, JSONObject message) {
        try {
            String id = message.optString("id");
            String body = message.optString("body").trim();
            if (id.isEmpty() || body.isEmpty() || body.length() > 500) return;
            message.put("body", body);
            JSONObject packet = new JSONObject();
            packet.put("messageId", id);
            packet.put("communityMessage", message);
            prepareNewPacket(packet);
            if (signPacket(packet)) appendPacket(context, packet);
        } catch (Exception ignored) { }
    }

    private static void appendPacket(Context context, JSONObject packet) {
        if (!"VALID".equals(validatePacket(packet))) return;
        synchronized (BleMeshService.class) {
            SharedPreferences preferences = context.getSharedPreferences(PREFS, MODE_PRIVATE);
            String id = packet.optString("messageId");
            JSONObject delivery = deliveryStore(context).optJSONObject(id);
            if (delivery != null && "SERVER_CONFIRMED".equals(delivery.optString("status"))) return;
            Set<String> seen = new HashSet<>(preferences.getStringSet("seen", new HashSet<>()));
            if (!seen.add(id)) return;
            while (seen.size() > SEEN_ID_LIMIT) seen.remove(seen.iterator().next());
            preferences.edit().putStringSet("seen", seen).apply();

            JSONArray queue;
            try { queue = new JSONArray(preferences.getString("queue", "[]")); }
            catch (Exception ignored) { queue = new JSONArray(); }
            for (int i = 0; i < queue.length(); i++) {
                if (id.equals(queue.optJSONObject(i).optString("messageId"))) return;
            }
            queue.put(packet);
            while (queue.length() >= 100) {
                JSONObject removed = queue.optJSONObject(0);
                if (removed != null) updateDeliveryStatus(context, removed.optString("messageId"), "QUEUE_LIMIT_REACHED");
                queue.remove(0);
            }
            preferences.edit().putString("queue", queue.toString()).apply();
            updateDeliveryStatus(context, id, "PENDING");
        }
        if (currentService != null) currentService.dispatchPendingPackets();
    }

    private static JSONArray queuedPackets(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        JSONArray stored;
        try { stored = new JSONArray(preferences.getString("queue", "[]")); }
        catch (Exception ignored) { stored = new JSONArray(); }
        JSONArray valid = new JSONArray();
        boolean changed = false;
        long now = System.currentTimeMillis();
        JSONObject statuses = deliveryStore(context);
        for (int index = 0; index < stored.length(); index++) {
            JSONObject packet = stored.optJSONObject(index);
            if (packet == null) { changed = true; continue; }
            JSONObject delivery = statuses.optJSONObject(packet.optString("messageId"));
            if (delivery != null && "SERVER_CONFIRMED".equals(delivery.optString("status"))) {
                changed = true;
                continue;
            }
            String validation = validatePacket(packet);
            if (!"VALID".equals(validation)) {
                updateDeliveryStatus(context, packet.optString("messageId"), validation);
                changed = true;
            } else valid.put(packet);
        }
        if (changed) preferences.edit().putString("queue", valid.toString()).apply();
        return valid;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        currentService = this;
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            stopSelf();
            return;
        }
        running = true;
        advertiser = adapter.getBluetoothLeAdvertiser();
        scanner = adapter.getBluetoothLeScanner();
        startGattServer(manager);
        startAdvertising();
        startScanning();
        mainHandler.postDelayed(retryPendingPackets, 5_000L);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) { return START_STICKY; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        running = false;
        mainHandler.removeCallbacks(retryPendingPackets);
        if (currentService == this) currentService = null;
        activePeers.clear();
        if (scanner != null) scanner.stopScan(scanCallback);
        if (advertiser != null) advertiser.stopAdvertising(advertiseCallback);
        for (PeerConnection peer : connections.values()) peer.gatt.disconnect();
        connections.clear();
        if (gattServer != null) gattServer.close();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Nearby volunteer relay", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps ResQNet SOS relay available while this app is open.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openApp, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        return builder.setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("ResQNet nearby relay is active")
                .setContentText("Listening for nearby volunteer phones")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    private void startGattServer(BluetoothManager manager) {
        gattServer = manager.openGattServer(this, serverCallback);
        if (gattServer == null) return;
        BluetoothGattService service = new BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        BluetoothGattCharacteristic incidentCharacteristic = new BluetoothGattCharacteristic(
                INCIDENT_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
                BluetoothGattCharacteristic.PERMISSION_WRITE);
        BluetoothGattCharacteristic acknowledgementCharacteristic = new BluetoothGattCharacteristic(
                ACK_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ);
        acknowledgementCharacteristic.addDescriptor(new BluetoothGattDescriptor(CLIENT_CONFIGURATION_UUID,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        service.addCharacteristic(incidentCharacteristic);
        service.addCharacteristic(acknowledgementCharacteristic);
        gattServer.addService(service);
    }

    private void startAdvertising() {
        if (advertiser == null) return;
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
                .setConnectable(true)
                .build();
        AdvertiseData data = new AdvertiseData.Builder()
                .addServiceUuid(new ParcelUuid(SERVICE_UUID))
                .setIncludeDeviceName(false)
                .build();
        advertiser.startAdvertising(settings, data, advertiseCallback);
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override public void onStartFailure(int errorCode) { MainActivity.dispatchBleStatus("BLE advertising failed (" + errorCode + ")."); }
    };

    private void startScanning() {
        if (scanner == null) return;
        ScanFilter filter = new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE_UUID)).build();
        ScanSettings settings = new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
        scanner.startScan(Arrays.asList(filter), settings, scanCallback);
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            String address = device.getAddress();
            if (connections.containsKey(address)) return;
            try {
                BluetoothGatt gatt = device.connectGatt(BleMeshService.this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
                connections.put(address, new PeerConnection(gatt));
            } catch (SecurityException ignored) {}
        }
    };

    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
        @Override public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                activePeers.add(device.getAddress());
                recordActivity("Connected to a nearby device.");
                MainActivity.dispatchBleStatus(null);
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                activePeers.remove(device.getAddress());
                recordActivity("Nearby device disconnected.");
                MainActivity.dispatchBleStatus(null);
            }
        }

        @Override public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            if (responseNeeded) gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null);
            if (characteristic.getUuid().equals(INCIDENT_CHARACTERISTIC_UUID) && offset == 0) receiveFrame(value, device);
        }

        @Override public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
                BluetoothGattDescriptor descriptor, boolean preparedWrite, boolean responseNeeded,
                int offset, byte[] value) {
            descriptor.setValue(value);
            if (responseNeeded) gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
        }
    };

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
            String address = gatt.getDevice().getAddress();
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                activePeers.add(address);
                recordActivity("Connected to a nearby device.");
                gatt.discoverServices();
            } else {
                activePeers.remove(address);
                connections.remove(address);
                recordActivity("Nearby device disconnected.");
                gatt.close();
                MainActivity.dispatchBleStatus(null);
            }
        }

        @Override public void onServicesDiscovered(BluetoothGatt gatt, int status) {
            if (status != BluetoothGatt.GATT_SUCCESS) return;
            PeerConnection peer = connections.get(gatt.getDevice().getAddress());
            if (peer == null) return;
            peer.characteristic = gatt.getService(SERVICE_UUID) == null ? null
                    : gatt.getService(SERVICE_UUID).getCharacteristic(INCIDENT_CHARACTERISTIC_UUID);
            peer.acknowledgementCharacteristic = gatt.getService(SERVICE_UUID) == null ? null
                    : gatt.getService(SERVICE_UUID).getCharacteristic(ACK_CHARACTERISTIC_UUID);
            if (peer.characteristic == null || peer.acknowledgementCharacteristic == null) { gatt.disconnect(); return; }
            BluetoothGattDescriptor descriptor = peer.acknowledgementCharacteristic.getDescriptor(CLIENT_CONFIGURATION_UUID);
            if (!gatt.setCharacteristicNotification(peer.acknowledgementCharacteristic, true) || descriptor == null) {
                gatt.disconnect();
                return;
            }
            descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            if (!gatt.writeDescriptor(descriptor)) { gatt.disconnect(); return; }
        }

        @Override public void onDescriptorWrite(BluetoothGatt gatt, BluetoothGattDescriptor descriptor, int status) {
            PeerConnection peer = connections.get(gatt.getDevice().getAddress());
            if (status == BluetoothGatt.GATT_SUCCESS && peer != null) {
                peer.ackReady = true;
                if (!gatt.requestMtu(185)) sendNext(gatt);
            } else gatt.disconnect();
        }

        @Override public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
            if (characteristic.getUuid().equals(ACK_CHARACTERISTIC_UUID)) receiveAcknowledgement(gatt, characteristic.getValue());
        }

        @Override public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, byte[] value) {
            if (characteristic.getUuid().equals(ACK_CHARACTERISTIC_UUID)) receiveAcknowledgement(gatt, value);
        }

        @Override public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
            PeerConnection peer = connections.get(gatt.getDevice().getAddress());
            if (peer != null && status == BluetoothGatt.GATT_SUCCESS) peer.mtu = mtu;
            sendNext(gatt);
        }

        @Override public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
            PeerConnection peer = connections.get(gatt.getDevice().getAddress());
            if (peer == null) return;
            peer.writing = false;
            if (status != BluetoothGatt.GATT_SUCCESS) { gatt.disconnect(); return; }
            recordMetric("sentFrames", "Sent a BLE data frame to a nearby device.");
            Frame sentFrame = peer.frames.get(peer.frameIndex);
            peer.frameIndex++;
            sendNext(gatt);
        }
    };

    private void sendNext(BluetoothGatt gatt) {
        PeerConnection peer = connections.get(gatt.getDevice().getAddress());
        if (peer == null || peer.characteristic == null || !peer.ackReady || peer.writing) return;
        if (peer.frames == null || peer.frameIndex >= peer.frames.size()) {
            peer.frames = null;
            peer.frameIndex = 0;
            peer.frames = buildFrames(queuedPackets(this), peer.mtu, peer);
        }
        if (peer.frames.isEmpty()) return;
        byte[] frame = peer.frames.get(peer.frameIndex).bytes;
        Frame frameInfo = peer.frames.get(peer.frameIndex);
        if (frameInfo.packetFinal) {
            peer.awaitingAckIds.add(frameInfo.messageId);
            peer.awaitingAckHashes.put(toHex(hashBytes(frameInfo.messageId)), frameInfo.messageId);
            peer.lastSentAt.put(frameInfo.messageId, System.currentTimeMillis());
        }
        peer.characteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
        peer.characteristic.setValue(frame);
        peer.writing = true;
        boolean queued = gatt.writeCharacteristic(peer.characteristic);
        if (!queued) {
            peer.writing = false;
            gatt.disconnect();
        }
    }

    private List<Frame> buildFrames(JSONArray packets, int mtu, PeerConnection peer) {
        List<Frame> frames = new ArrayList<>();
        int chunkSize = Math.max(1, Math.min(180, mtu - 14));
        for (int packetIndex = 0; packetIndex < packets.length(); packetIndex++) {
            JSONObject packet = packets.optJSONObject(packetIndex);
            if (packet == null) continue;
            String messageId = packet.optString("messageId");
            if (messageId.isEmpty()) continue;
            if (peer.sentPacketIds.contains(messageId)) {
                int attempts = peer.packetAttempts.getOrDefault(messageId, 0);
                long lastSent = peer.lastSentAt.getOrDefault(messageId, 0L);
                if (!peer.awaitingAckIds.contains(messageId) || lastSent == 0
                        || System.currentTimeMillis() - lastSent < ACK_RETRY_MS
                        || attempts >= MAX_RETRIES_PER_CONNECTION) continue;
                peer.awaitingAckIds.remove(messageId);
                peer.awaitingAckHashes.values().remove(messageId);
                peer.sentPacketIds.remove(messageId);
                peer.packetAttempts.put(messageId, attempts + 1);
            } else peer.packetAttempts.put(messageId, 1);
            if (!"VALID".equals(validatePacket(packet))) continue;
            byte[] bytes = packet.toString().getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 1800) continue;
            byte[] transferId = hashBytes(messageId);
            int count = Math.max(1, (int) Math.ceil((double) bytes.length / chunkSize));
            if (count > 255) continue;
            peer.sentPacketIds.add(messageId);
            for (int index = 0; index < count; index++) {
                int start = index * chunkSize;
                int length = Math.min(chunkSize, bytes.length - start);
                ByteBuffer frame = ByteBuffer.allocate(11 + length);
                frame.put((byte) 0x52);
                frame.put(transferId, 0, 8);
                frame.put((byte) index);
                frame.put((byte) count);
                frame.put(bytes, start, length);
                frames.add(new Frame(frame.array(), messageId, index == count - 1));
            }
        }
        return frames;
    }

    private synchronized void receiveFrame(byte[] frame, BluetoothDevice sourceDevice) {
        if (frame == null || frame.length < 11 || frame[0] != 0x52) return;
        byte[] idBytes = Arrays.copyOfRange(frame, 1, 9);
        String transferId = toHex(idBytes);
        int index = frame[9] & 0xff;
        int total = frame[10] & 0xff;
        if (total == 0 || index >= total || total > 255) return;
        Transfer transfer = incomingTransfers.get(transferId);
        if (transfer == null) {
            transfer = new Transfer(total, sourceDevice);
            incomingTransfers.put(transferId, transfer);
        }
        if (transfer.total != total || !transfer.sourceDevice.getAddress().equals(sourceDevice.getAddress())) { incomingTransfers.remove(transferId); return; }
        transfer.parts.put(index, Arrays.copyOfRange(frame, 11, frame.length));
        if (transfer.parts.size() != total) return;
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            for (int part = 0; part < total; part++) output.write(transfer.parts.get(part));
            JSONObject packet = new JSONObject(new String(output.toByteArray(), StandardCharsets.UTF_8));
            incomingTransfers.remove(transferId);
            acceptPacket(packet, transferId, sourceDevice);
        } catch (Exception ignored) { incomingTransfers.remove(transferId); }
    }

    private void acceptPacket(JSONObject packet, String transferId, BluetoothDevice sourceDevice) throws Exception {
        String messageId = packet.optString("messageId");
        int ttl = packet.optInt("ttl", 0);
        JSONObject incident = packet.optJSONObject("incident");
        JSONObject communityMessage = packet.optJSONObject("communityMessage");
        if (messageId.isEmpty() || (incident == null && communityMessage == null)) return;
        if (!transferId.equals(toHex(hashBytes(messageId)))) return;
        String validation = validatePacket(packet);
        if (validation.equals("INVALID_SIGNATURE")) {
            updateDeliveryStatus(this, messageId, "INVALID_SIGNATURE");
            recordActivity("Rejected a BLE packet with an invalid origin signature.");
            sendAcknowledgement(sourceDevice, messageId, (byte) 4);
            return;
        }
        if (validation.equals("EXPIRED") || validation.equals("HOP_LIMIT_REACHED")) {
            updateDeliveryStatus(this, messageId, validation);
            sendAcknowledgement(sourceDevice, messageId, (byte) (validation.equals("EXPIRED") ? 3 : 2));
            return;
        }
        if (incident != null && !messageId.equals(incident.optString("clientUuid"))) return;
        if (communityMessage != null && !messageId.equals(communityMessage.optString("id"))) return;
        SharedPreferences preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        Set<String> seen = new HashSet<>(preferences.getStringSet("seen", new HashSet<>()));
        if (seen.contains(messageId)) {
            sendAcknowledgement(sourceDevice, messageId, (byte) 1);
            return;
        }
        seen.add(messageId);
        while (seen.size() > SEEN_ID_LIMIT) seen.remove(seen.iterator().next());
        preferences.edit().putStringSet("seen", seen).apply();

        if (communityMessage != null) {
            if (communityMessage.optString("body").trim().isEmpty() || communityMessage.optString("body").length() > 500) return;
            JSONObject storedMessage = new JSONObject(communityMessage.toString());
            storedMessage.put("hopCount", packet.optInt("hopCount", 0) + 1);
            CommunityMessageStore.upsert(this, storedMessage);
            recordMetric("receivedPackets", "Received a community message from a nearby device.");
            MainActivity.dispatchRelayedCommunityMessage(storedMessage);
        } else {
            JSONObject storedIncident = new JSONObject(incident.toString());
            storedIncident.put("status", "REPORTED");
            storedIncident.put("relayReceived", true);
            storedIncident.put("relayHopCount", packet.optInt("hopCount", 0) + 1);
            storedIncident.put("originFingerprint", fingerprint(packet.optString("originPublicKey")));
            storedIncident.put("originSignatureVerified", true);
            storedIncident.put("isLocalReport", true);
            IncidentStore.upsert(this, storedIncident);
            recordMetric("receivedPackets", "Received an emergency report from a nearby device.");
            MainActivity.dispatchRelayedIncident(storedIncident);
        }
        updateDeliveryStatus(this, messageId, "RELAYED");
        sendAcknowledgement(sourceDevice, messageId, (byte) 1);
        if (ttl > 1 && packet.optInt("hopCount", 0) + 1 < packet.optInt("maxHops", 0)) {
            packet.put("ttl", ttl - 1);
            packet.put("hopCount", packet.optInt("hopCount", 0) + 1);
            appendForwardedPacket(this, packet);
        }
    }

    private void sendAcknowledgement(BluetoothDevice device, String messageId, byte outcome) {
        if (gattServer == null || device == null) return;
        BluetoothGattService service = gattServer.getService(SERVICE_UUID);
        BluetoothGattCharacteristic characteristic = service == null ? null : service.getCharacteristic(ACK_CHARACTERISTIC_UUID);
        if (characteristic == null) return;
        byte[] idHash = hashBytes(messageId);
        characteristic.setValue(ByteBuffer.allocate(9).put(idHash, 0, 8).put(outcome).array());
        gattServer.notifyCharacteristicChanged(device, characteristic, false);
    }

    private void receiveAcknowledgement(BluetoothGatt gatt, byte[] value) {
        if (value == null || value.length < 9) return;
        PeerConnection peer = connections.get(gatt.getDevice().getAddress());
        if (peer == null) return;
        String idHash = toHex(Arrays.copyOfRange(value, 0, 8));
        String messageId = peer.awaitingAckHashes.remove(idHash);
        if (messageId == null) return;
        peer.awaitingAckIds.remove(messageId);
        byte outcome = value[8];
        if (outcome == 1) {
            updateDeliveryStatus(this, messageId, "RELAYED");
            recordActivity("A nearby phone acknowledged receipt. Emergency services are not yet confirmed.");
        } else if (outcome == 3) {
            updateDeliveryStatus(this, messageId, "EXPIRED");
            recordActivity("A nearby phone rejected an expired packet.");
        } else if (outcome == 4) {
            updateDeliveryStatus(this, messageId, "INVALID_SIGNATURE");
            recordActivity("A nearby phone rejected a packet with an invalid signature.");
        } else {
            updateDeliveryStatus(this, messageId, "HOP_LIMIT_REACHED");
            recordActivity("A nearby phone could not forward this packet further.");
        }
        sendNext(gatt);
    }

    private static String fingerprint(String encodedPublicKey) {
        try {
            byte[] key = Base64.getDecoder().decode(encodedPublicKey);
            return toHex(MessageDigest.getInstance("SHA-256").digest(key)).substring(0, 16);
        } catch (Exception ignored) { return "unknown"; }
    }

    private static void appendForwardedPacket(Context context, JSONObject packet) {
        if (!"VALID".equals(validatePacket(packet))) return;
        SharedPreferences preferences = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        JSONArray queue;
        try { queue = new JSONArray(preferences.getString("queue", "[]")); }
        catch (Exception ignored) { queue = new JSONArray(); }
        String id = packet.optString("messageId");
        for (int i = 0; i < queue.length(); i++) {
            if (id.equals(queue.optJSONObject(i).optString("messageId"))) return;
        }
        queue.put(packet);
        while (queue.length() >= 100) {
            JSONObject removed = queue.optJSONObject(0);
            if (removed != null) updateDeliveryStatus(context, removed.optString("messageId"), "QUEUE_LIMIT_REACHED");
            queue.remove(0);
        }
        preferences.edit().putString("queue", queue.toString()).apply();
        if (currentService != null) currentService.dispatchPendingPackets();
    }

    private void dispatchPendingPackets() {
        mainHandler.post(() -> {
            for (PeerConnection peer : connections.values()) sendNext(peer.gatt);
        });
    }

    private static byte[] hashBytes(String value) {
        try { return Arrays.copyOf(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)), 8); }
        catch (Exception ignored) { return new byte[8]; }
    }

    private static String toHex(byte[] value) {
        StringBuilder result = new StringBuilder();
        for (byte item : value) result.append(String.format(java.util.Locale.US, "%02x", item & 0xff));
        return result.toString();
    }

    static void startFromActivity(Context context) {
        Intent intent = new Intent(context, BleMeshService.class).setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
        else context.startService(intent);
    }

    private static final class PeerConnection {
        final BluetoothGatt gatt;
        BluetoothGattCharacteristic characteristic;
        BluetoothGattCharacteristic acknowledgementCharacteristic;
        List<Frame> frames;
        final Set<String> sentPacketIds = new HashSet<>();
        final Set<String> awaitingAckIds = new HashSet<>();
        final Map<String, String> awaitingAckHashes = new HashMap<>();
        final Map<String, Integer> packetAttempts = new HashMap<>();
        final Map<String, Long> lastSentAt = new HashMap<>();
        int frameIndex = 0;
        int mtu = 23;
        boolean writing = false;
        boolean ackReady = false;
        PeerConnection(BluetoothGatt gatt) { this.gatt = gatt; }
    }

    private static final class Frame {
        final byte[] bytes;
        final String messageId;
        final boolean packetFinal;
        Frame(byte[] bytes, String messageId, boolean packetFinal) {
            this.bytes = bytes;
            this.messageId = messageId;
            this.packetFinal = packetFinal;
        }
    }

    private static final class Transfer {
        final int total;
        final BluetoothDevice sourceDevice;
        final Map<Integer, byte[]> parts = new HashMap<>();
        Transfer(int total, BluetoothDevice sourceDevice) { this.total = total; this.sourceDevice = sourceDevice; }
    }
}
