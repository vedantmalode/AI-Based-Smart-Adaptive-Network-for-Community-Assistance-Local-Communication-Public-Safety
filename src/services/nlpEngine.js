// ResQNet AI / NLP Emergency Prioritization & Severity Model

// Critical urgency keywords weighted by severity impact
const URGENCY_KEYWORDS = {
  critical: [
    "explosion", "flames", "trapped", "bleeding", "unconscious", "head injury", 
    "burns", "submerged", "collapsed", "toxic", "gas leak", "cardiac arrest",
    "deadly", "mass casualty", "fatal", "choking", "drowning", "electrocuted",
    "सांस नहीं", "साँस नहीं", "बेहोश", "गंभीर रक्तस्राव", "डूब रहा", "दिल का दौरा",
    "श्वास नहीं ले रहा", "सांस नहीं ले पा रहा", "बहुत खून बह रहा", "लोग फंसे हैं", "बाढ़ में फंसे", "आदमी बेहोश",
    "श्वास घेत नाही", "बेशुद्ध", "तीव्र रक्तस्त्राव", "बुडत आहे", "हृदयविकाराचा झटका", "खूप रक्त वाहत आहे", "लोक अडकले आहेत", "पुरात अडकले", "माणूस बेशुद्ध",
    "শ্বাস নিচ্ছে না", "অচেতন", "প্রচুর রক্তপাত", "ডুবে যাচ্ছে",
    "மூச்சு இல்லை", "மயக்கம்", "அதிக இரத்தப்போக்கு", "நீரில் மூழ்குதல்",
    "શ્વાસ નથી", "બેભાન", "ગંભીર રક્તસ્રાવ", "ડૂબી રહ્યો",
    "శ్వాస తీసుకోవడం లేదు", "అపస్మారక", "తీవ్రమైన రక్తస్రావం", "మునిగిపోతున్న"
  ],
  high: [
    "fire", "flood", "collision", "accident", "fracture", "smoke",
    "panic", "stranded", "overflow", "damage", "blaze", "severe pain",
    "short circuit", "overturned", "landslide", "आग लगी", "बाढ़", "भूकंप", "चोट लगी",
    "आग लग गई", "सड़क हादसा", "गाड़ी पलट गई", "फंस गए", "भवन गिर गया", "खून बह रहा", "मदद करो", "बचाओ", "सांस लेने में दिक्कत", "सीने में दर्द",
    "आग लागली", "पूर", "भूकंप", "जखमी", "अपघात झाला", "गाडी पलटली", "इमारत कोसळली", "धूर येत आहे", "पूर आला", "रक्त येत आहे", "मदत करा", "वाचवा", "श्वास घ्यायला त्रास", "छातीत दुखतंय",
    "আগুন", "বন্যা", "ভূমিকম্প", "আহত",
    "தீ", "வெள்ளம்", "நிலநடுக்கம்", "காயம்", "આગ", "પૂર", "ભૂકંપ", "ઈજા",
    "అగ్ని", "వరద", "భూకంపం", "గాయం"
  ],
  medium: [
    "spill", "minor injury", "leak", "blocked road", "waterlogging",
    "power outage", "storm", "fallen tree", "wire", "debris"
  ]
};

/**
 * Predict Emergency Severity, Category, and Priority Score using NLP text analytics
 * @param {Object} reportData
 * @returns {Object} AI Prediction results
 */
export function predictIncident(reportData) {
  const {
    description = "",
    category = "Other",
    peopleAffected = 1,
    injuries = false,
    trapped = false,
    firePresent = false
  } = reportData;
  const peopleCountKnown = reportData.peopleAffectedKnown !== false
    && Number.isFinite(Number(peopleAffected)) && Number(peopleAffected) > 0;
  const effectivePeopleAffected = peopleCountKnown ? Number(peopleAffected) : 1;
  const descriptionText = String(description || '');

  const textLower = descriptionText.toLocaleLowerCase();
  
  // 1. Extract keyword matches
  const matchedCritical = URGENCY_KEYWORDS.critical.filter(w => textLower.includes(w));
  const matchedHigh = URGENCY_KEYWORDS.high.filter(w => textLower.includes(w));
  const matchedMedium = URGENCY_KEYWORDS.medium.filter(w => textLower.includes(w));

  const allMatched = [...matchedCritical, ...matchedHigh, ...matchedMedium];

  // 2. Base score from category default baseline
  let baseScore = 40;
  switch (category) {
    case "Fire":
    case "Building Collapse":
      baseScore = 65;
      break;
    case "Medical Emergency":
    case "Road Accident":
      baseScore = 60;
      break;
    case "Flood":
    case "Earthquake":
      baseScore = 55;
      break;
    case "Electrical Emergency":
    case "Gas Leak":
      baseScore = 50;
      break;
    default:
      baseScore = 35;
  }

  // 3. NLP keyword weight calculation
  let keywordBonus = (matchedCritical.length * 12) + (matchedHigh.length * 6) + (matchedMedium.length * 2);

  // 4. Incident context modifiers
  let contextBonus = 0;
  if (trapped) contextBonus += 15;
  if (injuries) contextBonus += 12;
  if (firePresent) contextBonus += 10;
  
  // Scaled headcount factor (logarithmic scale max 15 pts)
  const headcountFactor = Math.min(15, Math.round(Math.log2(effectivePeopleAffected + 1) * 4));

  // 5. Final Composite Priority Score (bounded 1 to 99)
  const rawScore = baseScore + keywordBonus + contextBonus + headcountFactor;
  let priorityScore = Math.min(99, Math.max(15, rawScore));

  // 6. Map Priority Score to Severity Level
  let severity = "LOW";
  if (priorityScore >= 85) {
    severity = "CRITICAL";
  } else if (priorityScore >= 70) {
    severity = "HIGH";
  } else if (priorityScore >= 50) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  // Heuristic confidence reflects usable report detail, not a calibrated probability.
  const hasLocation = (Number.isFinite(reportData.location?.lat) && Number.isFinite(reportData.location?.lng))
    || Boolean(reportData.location?.address?.trim());
  let confidence = 0.58;
  if (descriptionText.trim().length >= 25) confidence += 0.08;
  if (descriptionText.trim().length >= 80) confidence += 0.06;
  if (allMatched.length > 0) confidence += 0.08;
  if (category && category !== 'Other') confidence += 0.05;
  if (injuries || trapped || firePresent) confidence += 0.04;
  if (hasLocation) confidence += 0.06;
  if (peopleCountKnown) confidence += 0.04;
  confidence = Math.min(0.95, roundToTwo(confidence));

  // 8. Detected category refinement via NLP if "Other" was picked
  let predictedCategory = category;
  if (category === "Other" || category === "") {
    const hasMatch = (terms) => allMatched.some((matched) => terms.includes(matched));
    if (hasMatch(["flames", "fire", "blaze", "आग लगी", "आग लग गई", "आग लागली", "আগুন", "தீ", "આગ", "అగ్ని"])) {
      predictedCategory = "Fire";
    } else if (hasMatch(["collision", "accident", "overturned", "सड़क हादसा", "गाड़ी पलट गई", "अपघात झाला", "गाडी पलटली"])) {
      predictedCategory = "Road Accident";
    } else if (hasMatch(["cardiac arrest", "unconscious", "bleeding", "दिल का दौरा", "बेहोश", "श्वास घेत नाही", "बेशुद्ध", "आदमी बेहोश", "माणूस बेशुद्ध", "सांस लेने में दिक्कत", "सीने में दर्द", "श्वास घ्यायला त्रास", "छातीत दुखतंय", "খून বহ रहा", "रक्त येत आहे", "অচেতন", "மயக்கம்", "બેભાન", "అపస్మారక"])) {
      predictedCategory = "Medical Emergency";
    } else if (hasMatch(["flood", "submerged", "बाढ़", "બुडत", "বন্যা", "வெள்ளம்", "પૂર", "వరద"])) {
      predictedCategory = "Flood";
    } else if (hasMatch(["earthquake", "collapsed", "भूकंप", "ভূমিকম্প", "நிலநடுக்கம்", "ભૂકંપ", "భూకంపం"])) {
      predictedCategory = "Earthquake";
    }
  }

  if (category === 'Other' && predictedCategory === 'Other') {
    if (firePresent) {
      predictedCategory = 'Fire';
    } else if (["बाढ़ में फंसे", "लोग बाढ़ में फंसे", "पुरात अडकले", "पूर", "बुडत आहे"].some((phrase) => textLower.includes(phrase))) {
      predictedCategory = 'Flood';
    } else if (["खून बह रहा", "रक्त येत आहे", "सांस लेने में दिक्कत", "सीने में दर्द", "श्वास घ्यायला त्रास", "छातीत दुखतंय"].some((phrase) => textLower.includes(phrase))) {
      predictedCategory = 'Medical Emergency';
    }
  }

  // If text refined an "Other" report into a known hazard, use that hazard's baseline too.
  if (predictedCategory !== category) {
    const inferredBaseScores = {
      'Fire': 65,
      'Building Collapse': 65,
      'Medical Emergency': 60,
      'Road Accident': 60,
      'Flood': 55,
      'Earthquake': 55,
      'Electrical Emergency': 50,
      'Gas Leak': 50,
    };
    baseScore = inferredBaseScores[predictedCategory] || baseScore;
    priorityScore = Math.min(99, Math.max(15, baseScore + keywordBonus + contextBonus + headcountFactor));
    severity = priorityScore >= 85 ? 'CRITICAL' : priorityScore >= 70 ? 'HIGH' : priorityScore >= 50 ? 'MEDIUM' : 'LOW';
  }

  const hasFireSignal = predictedCategory === 'Fire' || firePresent;
  const hasFloodSignal = predictedCategory === 'Flood';
  const hasMedicalSignal = predictedCategory === 'Medical Emergency' || injuries;
  const hasStructuralSignal = ['Earthquake', 'Building Collapse'].includes(predictedCategory);
  const immediateDanger = matchedCritical.length > 0 || trapped;
  const priorityBand = immediateDanger || effectivePeopleAffected >= 10
    || (hasFireSignal && (hasMedicalSignal || effectivePeopleAffected >= 5))
    || (hasFloodSignal && (effectivePeopleAffected >= 5 || matchedCritical.length > 0))
    ? 'P0'
    : (hasMedicalSignal || hasFireSignal || hasFloodSignal || hasStructuralSignal || effectivePeopleAffected >= 3)
      ? 'P1'
      : (matchedMedium.length > 0 || predictedCategory !== 'Other') ? 'P2' : 'P3';
  const recommendedResources = (() => {
    switch (predictedCategory) {
      case 'Fire': return ['FIRE_RESCUE', ...(injuries || effectivePeopleAffected >= 5 ? ['MEDICAL_TEAM'] : [])];
      case 'Medical Emergency': return ['MEDICAL_TEAM', 'AMBULANCE'];
      case 'Road Accident': return [...(injuries ? ['MEDICAL_TEAM', 'AMBULANCE'] : []), 'TRAFFIC_CONTROL'];
      case 'Flood': return ['WATER_RESCUE', 'EVACUATION_SUPPORT'];
      case 'Earthquake':
      case 'Building Collapse': return ['SEARCH_AND_RESCUE', 'MEDICAL_TEAM'];
      case 'Electrical Emergency': return ['ELECTRICAL_UTILITY', ...(firePresent ? ['FIRE_RESCUE'] : [])];
      case 'Crime/Security': return ['POLICE_SECURITY'];
      case 'Cyclone/Storm': return ['CIVIL_DEFENSE', 'EVACUATION_SUPPORT'];
      default: return ['AREA_RESPONSE_TEAM'];
    }
  })();

  const priorityReasons = [];
  if (matchedCritical.length) priorityReasons.push(`Immediate danger phrase detected: ${matchedCritical.slice(0, 3).join(', ')}`);
  if (trapped) priorityReasons.push('People reported trapped');
  if (firePresent) priorityReasons.push('Active fire or smoke reported');
  if (injuries) priorityReasons.push('Injuries reported');
  if (peopleCountKnown && effectivePeopleAffected >= 5) priorityReasons.push(`${effectivePeopleAffected} people reported affected or at risk`);
  if (!priorityReasons.length && predictedCategory !== 'Other') priorityReasons.push(`${predictedCategory} has an elevated response baseline`);
  if (!priorityReasons.length && matchedHigh.length) priorityReasons.push(`Urgency phrase detected: ${matchedHigh.slice(0, 3).join(', ')}`);
  if (!priorityReasons.length) priorityReasons.push('No explicit life-threatening phrase detected; responder review is still required');

  const missingInformation = [];
  if (!descriptionText.trim()) missingInformation.push('Describe what happened and any immediate danger.');
  if (!hasLocation) missingInformation.push('Add a location or nearby landmark.');
  if (!peopleCountKnown) missingInformation.push('Estimate how many people are affected, if safe to do so.');

  const reviewFlags = [];
  const normalizedDescription = normalizeText(descriptionText);
  const words = normalizedDescription.split(/\s+/).filter(Boolean);
  if (words.length > 0 && normalizedDescription.length < 12) reviewFlags.push('Report details are very brief; confirm the hazard and immediate risks if possible.');
  if (words.length >= 6) {
    const counts = words.reduce((result, word) => ({ ...result, [word]: (result[word] || 0) + 1 }), {});
    if (Math.max(...Object.values(counts)) / words.length >= 0.6) reviewFlags.push('Description repeats the same word; verify report details.');
  }
  const potentialDuplicates = findPotentialDuplicates(reportData, normalizedDescription);
  if (potentialDuplicates.length) reviewFlags.push(`Possible duplicate of ${potentialDuplicates.map((item) => item.id).join(', ')}; compare reports before merging.`);

  return {
    category: predictedCategory,
    severity,
    priorityBand,
    priorityScore,
    confidence,
    recommendedResources,
    matchedKeywords: allMatched,
    priorityReasons,
    missingInformation,
    reviewFlags,
    potentialDuplicates,
    needsHumanReview: reviewFlags.length > 0 || missingInformation.length > 0,
    confidenceNote: 'Heuristic confidence based on report detail and matched signals; it is not a calibrated probability.',
    breakdown: {
      baseCategoryScore: baseScore,
      nlpKeywordWeight: keywordBonus,
      contextRiskModifier: contextBonus,
      headcountFactor
    },
    explanation: `Suggested ${priorityBand} · ${severity} (${priorityScore}/100). ${priorityReasons.join('; ')}.`,
    priorityReason: priorityReasons.join('; '),
  };
}

function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function findPotentialDuplicates(reportData, normalizedDescription) {
  if (!normalizedDescription) return [];
  const now = Date.now();
  const reportCategory = String(reportData.category || '').toLowerCase();
  const reportLocation = reportData.location;
  return (reportData.existingIncidents || []).filter((incident) => {
    if (!incident || (incident.clientUuid && incident.clientUuid === reportData.clientUuid)) return false;
    const reportedAt = Date.parse(incident.reportedAt || incident.createdAt || '');
    if (Number.isFinite(reportedAt) && (now - reportedAt > 24 * 60 * 60 * 1000 || reportedAt > now + 5 * 60 * 1000)) return false;
    const oldText = normalizeText(incident.description);
    const exactText = oldText.length >= 12 && oldText === normalizedDescription;
    const sameCategory = !reportCategory || !incident.category || reportCategory === String(incident.category).toLowerCase();
    if (!sameCategory && !exactText) return false;
    const oldWords = new Set(oldText.split(/\s+/).filter((word) => word.length > 2));
    const newWords = new Set(normalizedDescription.split(/\s+/).filter((word) => word.length > 2));
    const overlap = [...newWords].filter((word) => oldWords.has(word)).length;
    const similarity = overlap / Math.max(1, new Set([...oldWords, ...newWords]).size);
    const oldLocation = incident.location;
    const nearby = Number.isFinite(reportLocation?.lat) && Number.isFinite(reportLocation?.lng)
      && Number.isFinite(oldLocation?.lat) && Number.isFinite(oldLocation?.lng)
      && distanceKm(reportLocation.lat, reportLocation.lng, oldLocation.lat, oldLocation.lng) <= 0.5;
    return exactText || (sameCategory && nearby && similarity >= 0.35);
  }).slice(0, 5).map((incident) => ({ id: incident.id || incident.clientUuid || 'Existing report', category: incident.category || 'Unknown' }));
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
