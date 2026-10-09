package com.resqnet.mobile;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

final class IncidentStore {
    private static final String FILE_NAME = "incidents.json";

    private IncidentStore() {}

    static synchronized JSONArray read(Context context) throws Exception {
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.exists()) return new JSONArray();
        String content = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
        return new JSONArray(content);
    }

    static synchronized JSONObject upsert(Context context, JSONObject incident) throws Exception {
        if (!incident.has("id") || !incident.has("clientUuid") || !incident.has("location")) {
            throw new JSONException("Incident is missing required fields.");
        }
        JSONArray incidents = read(context);
        int match = -1;
        for (int index = 0; index < incidents.length(); index++) {
            JSONObject saved = incidents.getJSONObject(index);
            if (saved.optString("clientUuid").equals(incident.optString("clientUuid"))
                    || saved.optString("id").equals(incident.optString("id"))) {
                match = index;
                break;
            }
        }
        incident.put("isLocalReport", true);
        incident.put("nativeSavedAt", System.currentTimeMillis());
        if (match >= 0) incidents.put(match, incident);
        else incidents.put(incident);

        File file = new File(context.getFilesDir(), FILE_NAME);
        File temporary = new File(context.getFilesDir(), FILE_NAME + ".tmp");
        Files.write(temporary.toPath(), incidents.toString(2).getBytes(StandardCharsets.UTF_8));
        if (!temporary.renameTo(file)) {
            Files.copy(temporary.toPath(), file.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            temporary.delete();
        }
        return incident;
    }
}
