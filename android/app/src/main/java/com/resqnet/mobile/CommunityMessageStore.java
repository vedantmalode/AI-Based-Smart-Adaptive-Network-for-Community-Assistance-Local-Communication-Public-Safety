package com.resqnet.mobile;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

final class CommunityMessageStore {
    private static final String FILE_NAME = "community-messages.json";
    private CommunityMessageStore() { }

    static synchronized JSONArray read(Context context) throws Exception {
        File file = new File(context.getFilesDir(), FILE_NAME);
        if (!file.exists()) return new JSONArray();
        return new JSONArray(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
    }

    static synchronized JSONObject upsert(Context context, JSONObject message) throws Exception {
        if (message.optString("id").isEmpty() || message.optString("body").isEmpty())
            throw new IllegalArgumentException("Community message requires an id and body.");
        JSONArray messages = read(context);
        for (int i = 0; i < messages.length(); i++) {
            if (message.optString("id").equals(messages.optJSONObject(i).optString("id"))) return messages.getJSONObject(i);
        }
        message.put("receivedOnDevice", true);
        messages.put(message);
        while (messages.length() > 500) messages.remove(0);
        File temporary = new File(context.getFilesDir(), FILE_NAME + ".tmp");
        File target = new File(context.getFilesDir(), FILE_NAME);
        Files.write(temporary.toPath(), messages.toString(2).getBytes(StandardCharsets.UTF_8));
        if (!temporary.renameTo(target)) {
            Files.copy(temporary.toPath(), target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            temporary.delete();
        }
        return message;
    }
}
