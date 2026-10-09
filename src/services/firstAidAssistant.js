// Link each instruction to an authoritative emergency or first-aid reference.
const SOURCES = {
  emergency: { label: 'India emergency number 112', url: 'https://112.gov.in/' },
  check: { label: 'Red Cross: first aid steps', url: 'https://www.redcross.org/take-a-class/first-aid/performing-first-aid/first-aid-steps' },
  bleeding: { label: 'Red Cross: life-threatening bleeding', url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/bleeding-life-threatening-external' },
  burns: { label: 'WHO: burns first aid', url: 'https://www.who.int/news-room/fact-sheets/detail/burns' },
  burnCare: { label: 'Red Cross: burns', url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/burns' },
  choking: { label: 'Red Cross: adult and child choking', url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/adult-child-choking' },
  seizure: { label: 'Red Cross: seizures', url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/seizures' },
  fracture: { label: 'Red Cross: fractures', url: 'https://www.redcross.org/take-a-class/resources/learn-first-aid/fractures' },
  snakebite: { label: 'WHO: snakebite first aid', url: 'https://www.who.int/teams/control-of-neglected-tropical-diseases/snakebite-envenoming/treatment' },
  poisoning: { label: 'AIIMS National Poisons Information Centre', url: 'https://www.aiims.edu/index.php/en/npic_intro' },
};

// Keep SOS guidance brief, focused on immediate safety, and linked to sources.
const EMERGENCY_GUIDANCE = {
  'Road Accident': {
    title: 'Road accident safety',
    text: 'Keep yourself out of traffic and make the scene safer only if you can do so without risk. Call 112 for serious injury or trapped people. Avoid moving someone with a possible head, neck, or back injury unless the scene is immediately dangerous. For severe external bleeding, press firmly with clean cloth or gauze.',
    sources: [SOURCES.emergency, SOURCES.check, SOURCES.bleeding],
  },
  Fire: {
    title: 'Fire and burn safety',
    text: 'Leave the fire or smoke area and stay out; do not re-enter to retrieve belongings. Call 112. For a burn, first make sure it is safe, then cool it with clean, cool running water if available. Do not apply ice, toothpaste, or butter.',
    sources: [SOURCES.emergency, SOURCES.burns],
  },
  'Medical Emergency': {
    title: 'Medical emergency',
    text: 'Call 112 now for unconsciousness, abnormal breathing, severe bleeding, chest pain, or stroke signs. Keep the person at rest, stay with them, and follow the dispatcher’s instructions. Do not give food, drink, or medicines unless a qualified professional advises it.',
    sources: [SOURCES.emergency, SOURCES.check],
  },
  Flood: {
    title: 'Flood safety',
    text: 'Move to higher ground only if you can do so safely. Stay out of floodwater and away from fallen wires; do not walk or drive through water. Call 112 if someone is trapped or in immediate danger.',
    sources: [SOURCES.emergency],
  },
  Earthquake: {
    title: 'Earthquake safety',
    text: 'During shaking, protect your head and take cover if safe. Once it stops, move away from damaged buildings and wires if the route is clear. Do not enter damaged structures or rubble; call 112 for injuries or immediate danger.',
    sources: [SOURCES.emergency],
  },
  'Building Collapse': {
    title: 'Building collapse safety',
    text: 'Stay clear of unstable structures, dust, and wires. Do not enter rubble or move heavy debris. Call 112 and tell the operator the exact location and whether anyone is trapped.',
    sources: [SOURCES.emergency],
  },
  'Electrical Emergency': {
    title: 'Electrical hazard',
    text: 'Stay away from wires and standing water. Do not touch an injured person who may still be in contact with electricity. Cut power only if you can do so safely, then call 112.',
    sources: [SOURCES.emergency],
  },
  'Crime/Security': {
    title: 'Personal safety',
    text: 'Move to a safer place and avoid confronting the source of danger. Call 112 when safe to do so and share your location and immediate risks.',
    sources: [SOURCES.emergency],
  },
  'Cyclone/Storm': {
    title: 'Storm safety',
    text: 'Move indoors or to a safer shelter, away from windows, floodwater, and fallen wires. Do not go outside to inspect damage. Call 112 for immediate danger or trapped people.',
    sources: [SOURCES.emergency],
  },
  Other: {
    title: 'Stay safe while help is contacted',
    text: 'Keep a safe distance from the hazard and do not touch unknown substances, wires, or unstable objects. Call 112 for immediate danger and follow the operator’s directions.',
    sources: [SOURCES.emergency, SOURCES.check],
  },
};

/** Returns the reviewed safety message for a category, with a safe default. */
export function getEmergencyGuidance(category) {
  return EMERGENCY_GUIDANCE[category] || EMERGENCY_GUIDANCE.Other;
}

// Suggested questions help citizens start with common first-aid situations.
export const FIRST_AID_PROMPTS = [
  { label: 'Severe bleeding', text: 'What should I do for severe bleeding?' },
  { label: 'Burn', text: 'How do I help with a burn?' },
  { label: 'Choking', text: 'What should I do if someone is choking?' },
  { label: 'Seizure', text: 'How can I help someone having a seizure?' },
  { label: 'Possible fracture', text: 'What should I do for a possible broken bone?' },
  { label: 'Snakebite', text: 'What should I do after a snakebite?' },
  { label: 'Poisoning', text: 'What should I do if someone may have swallowed poison?' },
];

// Keep the chat assistant's response shape consistent across every topic.
const response = (title, text, sources, urgent = false) => ({ title, text, sources, urgent });

/** Matches common first-aid keywords to short sourced guidance; this is not diagnosis. */
export function getFirstAidResponse(question) {
  const text = String(question || '').toLowerCase().replace(/[’']/g, "'");
  const has = (...terms) => terms.some((term) => text.includes(term));

  if (has('snake bite', 'snakebite', 'bitten by a snake', 'snak bite')) {
    return response('Possible snakebite', 'Move away from the snake and keep the person still and calm. Remove rings, anklets, or other tight items near the bite in case swelling starts. Arrange urgent transport to a health facility. Do not cut or suck the wound, use a tight tourniquet, or apply herbal remedies. Call 112 if the person is unwell, breathing changes, or transport is needed urgently.', [SOURCES.snakebite, SOURCES.emergency], true);
  }
  if (has('burn', 'scald', 'hot water', 'fire on skin')) {
    return response('Burn or scald', 'First make sure the area is safe and stop contact with the heat. Cool the burn under clean, cool running water for about 20 minutes if available. Remove jewellery and loose clothing near it, but do not pull away anything stuck to the skin. Do not apply ice, butter, toothpaste, or creams. Get urgent medical help for a large or deep burn, or one on the face, hands, feet, or genitals; call 112 if severe.', [SOURCES.burns, SOURCES.burnCare, SOURCES.emergency]);
  }
  if (has('chok', 'something stuck in throat', 'cannot breathe while eating', "can't breathe while eating")) {
    return response('Choking', 'If the person can cough forcefully, encourage them to keep coughing and watch closely. If they cannot breathe, speak, or cough effectively, have someone call 112 and follow the dispatcher’s instructions. Give age-appropriate choking first aid only if you know how; infant and adult techniques differ. Do not do a blind finger sweep in the mouth.', [SOURCES.choking, SOURCES.emergency], true);
  }
  if (has('seizure', 'convulsion', 'fits')) {
    return response('Seizure', 'Move nearby hazards away and protect the person’s head with something soft if you can do so safely. Time the seizure. Do not restrain them and do not put anything in their mouth. When possible, help them onto their side and stay with them. Call 112 for a first seizure, one lasting over 5 minutes, repeated seizures, injury, trouble breathing, or a seizure in water.', [SOURCES.seizure, SOURCES.emergency]);
  }
  if (has('poison', 'swallowed chemical', 'overdose', 'cleaning liquid', 'pesticide')) {
    return response('Possible poisoning', 'Do not wait for symptoms and do not try to treat the person yourself or make them vomit. Call the AIIMS National Poisons Information Centre at 1800 116 117 for expert instructions, and call 112 for severe symptoms, breathing trouble, collapse, or immediate danger. Keep the product container or label available for the responder.', [SOURCES.poisoning, SOURCES.emergency], true);
  }
  if (has('bleed', 'bleeding', 'blood', 'deep cut', 'wound', 'cut')) {
    return response('Bleeding or wound', 'Check that the scene is safe and protect your hands if possible. For external bleeding, place clean cloth or gauze over the wound and press firmly and continuously. If blood is spurting, bleeding is heavy, the person is weak or confused, or it does not stop, call 112 now. Do not remove an object embedded in the wound; press around it and wait for medical help.', [SOURCES.bleeding, SOURCES.emergency], true);
  }
  if (has('broken bone', 'fracture', 'dislocated', 'sprain', 'twisted ankle', 'bone injury')) {
    return response('Possible bone or joint injury', 'Treat it as a possible fracture. Ask the person to stay still and support the injured part in the position found; do not straighten it or try to put a joint back in place. A cold pack wrapped in cloth may help a closed injury. Call 112 for a severe injury, an open wound or visible bone, numbness, shock, or head, neck, back, pelvis, or upper-leg injury.', [SOURCES.fracture, SOURCES.emergency]);
  }
  if (has('unconscious', 'not waking', "won't wake", 'not responding', 'not breathing', "isn't breathing", 'gasping', 'cardiac arrest')) {
    return response('Unresponsive person', 'Check that the scene is safe, then check responsiveness and normal breathing. Call 112 immediately or ask someone specific to call. If they are not breathing normally or are only gasping, start CPR and use an AED if available, following the emergency dispatcher’s instructions and your training. If they are breathing, keep checking their breathing; avoid moving them if a neck or back injury is possible unless the scene is unsafe.', [SOURCES.check, SOURCES.emergency], true);
  }
  if (has('heart attack', 'chest pain', 'stroke', 'face droop', 'slurred speech', 'weakness on one side', "can't breathe", 'cannot breathe', 'difficulty breathing', 'trouble breathing')) {
    return response('Possible medical emergency', 'Call 112 now. Tell the dispatcher what happened and where you are. Keep the person at rest, stay with them, and watch their breathing and responsiveness. Do not give food, drink, or medicines unless a qualified professional or dispatcher tells you to.', [SOURCES.emergency, SOURCES.check], true);
  }

  return response('I can help with common first-aid topics', 'I did not recognize that question. Try one of the topic buttons, or describe whether this is bleeding, a burn, choking, a seizure, a possible fracture, snakebite, or poisoning. If the person is in immediate danger, unconscious, struggling to breathe, or bleeding heavily, call 112 now.', [SOURCES.check, SOURCES.emergency]);
}

export const FIRST_AID_GREETING = 'I can share basic first-aid steps for common emergencies. What happened? If anyone is in immediate danger, call 112 now. I cannot diagnose, and this guide is not a substitute for emergency or medical care.';
