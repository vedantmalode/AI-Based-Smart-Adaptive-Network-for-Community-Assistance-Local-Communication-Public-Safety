// ResQNet Bluetooth Low Energy (BLE) Mesh Relay Prototype Simulator

/**
 * Generate SHA-256 style hash string for BLE payload deduplication
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'ble-hash-' + Math.abs(hash).toString(16);
}

/**
 * Simulate P2P BLE Emergency Packet Propagation across mesh nodes
 */
export function simulateBLERelayHop(incidentData) {
  const messageId = `BLE-MSG-${Date.now().toString(36).toUpperCase()}`;
  const senderDeviceId = `DEV-CITIZEN-${Math.floor(1000 + Math.random() * 9000)}`;
  const payloadStr = JSON.stringify({
    uuid: incidentData.clientUuid || incidentData.id,
    cat: incidentData.category,
    lat: incidentData.location.lat,
    lng: incidentData.location.lng,
    desc: incidentData.description
  });

  const payloadHash = simpleHash(payloadStr);

  // Mesh Nodes involved in relay
  const hopNodes = [
    {
      step: 1,
      nodeId: senderDeviceId,
      nodeType: "Originating Smartphone (No Cellular)",
      action: "Broadcasted SOS Packet via BLE GATT Advertising (UUID: 0000-ERDM-0000)",
      timestamp: new Date().toLocaleTimeString(),
      signalStrength: "-42 dBm",
      hopCount: 0
    },
    {
      step: 2,
      nodeId: "DEV-VOLUNTEER-4819",
      nodeType: "Nearby Volunteer Device (~85m range)",
      action: "Scanned & Received BLE Packet. Stored in IndexedDB buffer. Added to relay chain.",
      timestamp: new Date(Date.now() + 1500).toLocaleTimeString(),
      signalStrength: "-68 dBm",
      hopCount: 1
    },
    {
      step: 3,
      nodeId: "DEV-RESCUE-GATEWAY-102",
      nodeType: "Emergency Response Patrol Vehicle (Cellular Uplink Active)",
      action: "Received BLE Relay Packet. Detected active 4G/5G connection. Initiated Cloud API Sync.",
      timestamp: new Date(Date.now() + 3200).toLocaleTimeString(),
      signalStrength: "-54 dBm",
      hopCount: 2
    },
    {
      step: 4,
      nodeId: "ResQNet Central API",
      nodeType: "Cloud Server",
      action: "Validated SHA-256 payload hash (No Dup). Deduplicated packet. Broadcasted live SOS map alert to HQ.",
      timestamp: new Date(Date.now() + 3800).toLocaleTimeString(),
      signalStrength: "L3 Uplink OK",
      hopCount: 3
    }
  ];

  const packet = {
    v: 1,
    messageId,
    emergencyId: incidentData.id || incidentData.clientUuid,
    senderDeviceId,
    payloadHash,
    ttlSeconds: 300,
    maxHops: 5,
    currentHopCount: 3,
    relayChain: [senderDeviceId, "DEV-VOLUNTEER-4819", "DEV-RESCUE-GATEWAY-102"],
    packetData: {
      category: incidentData.category,
      title: incidentData.title || "Offline BLE SOS",
      description: incidentData.description,
      location: incidentData.location,
      peopleAffected: incidentData.peopleAffected || 1,
      timestamp: new Date().toISOString()
    },
    hops: hopNodes
  };

  return packet;
}
