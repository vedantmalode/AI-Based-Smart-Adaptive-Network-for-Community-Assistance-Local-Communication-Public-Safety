// ResQNet AI / NLP Emergency Prioritization & Severity Model

// Critical urgency keywords weighted by severity impact
const URGENCY_KEYWORDS = {
  critical: [
    "explosion", "flames", "trapped", "bleeding", "unconscious", "head injury", 
    "burns", "submerged", "collapsed", "toxic", "gas leak", "cardiac arrest",
    "deadly", "mass casualty", "fatal", "choking", "drowning", "electrocuted"
  ],
  high: [
    "fire", "flood", "collision", "accident", "fracture", "smoke",
    "panic", "stranded", "overflow", "damage", "blaze", "severe pain",
    "short circuit", "overturned", "landslide"
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

  const textLower = description.toLowerCase();
  
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
  const headcountFactor = Math.min(15, Math.round(Math.log2(peopleAffected + 1) * 4));

  // 5. Final Composite Priority Score (bounded 1 to 99)
  const rawScore = baseScore + keywordBonus + contextBonus + headcountFactor;
  const priorityScore = Math.min(99, Math.max(15, rawScore));

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

  // 7. Calculate Confidence Score (0.75 - 0.98 based on input completeness)
  let confidence = 0.82;
  if (description.length > 50) confidence += 0.06;
  if (allMatched.length > 0) confidence += 0.05;
  if (injuries || trapped) confidence += 0.04;
  confidence = Math.min(0.98, roundToTwo(confidence));

  // 8. Detected category refinement via NLP if "Other" was picked
  let predictedCategory = category;
  if (category === "Other" || category === "") {
    if (matchedCritical.includes("flames") || matchedHigh.includes("fire") || matchedHigh.includes("blaze")) {
      predictedCategory = "Fire";
    } else if (matchedHigh.includes("collision") || matchedHigh.includes("accident") || matchedHigh.includes("overturned")) {
      predictedCategory = "Road Accident";
    } else if (matchedCritical.includes("cardiac arrest") || matchedCritical.includes("unconscious") || matchedCritical.includes("bleeding")) {
      predictedCategory = "Medical Emergency";
    } else if (matchedHigh.includes("flood") || matchedCritical.includes("submerged")) {
      predictedCategory = "Flood";
    }
  }

  return {
    category: predictedCategory,
    severity,
    priorityScore,
    confidence,
    matchedKeywords: allMatched,
    breakdown: {
      baseCategoryScore: baseScore,
      nlpKeywordWeight: keywordBonus,
      contextRiskModifier: contextBonus,
      headcountFactor
    },
    explanation: `Assigned ${severity} priority (${priorityScore}/100) based on ${allMatched.length} urgency keywords ('${allMatched.join("', '") || 'none'}'), ${peopleAffected} affected people, and risk flags (trapped: ${trapped}, injuries: ${injuries}).`
  };
}

function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
