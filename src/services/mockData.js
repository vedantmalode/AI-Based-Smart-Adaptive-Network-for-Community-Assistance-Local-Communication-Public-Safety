// ResQNet Mock Seed Data & Academic Demonstration State — Nagpur, Maharashtra Zone

export const NAGPUR_CENTER = { lat: 21.1458, lng: 79.0882 };

export const INITIAL_INCIDENTS = [
  {
    id: "INC-8901",
    clientUuid: "client-uuid-8901",
    category: "Road Accident",
    title: "Multi-vehicle collision on Wardha Road near Airport Flyover",
    description: "Major collision involving a passenger bus and two cars near Nagpur Airport flyover. 4 people injured and trapped inside vehicles. Fuel spill reported.",
    severity: "CRITICAL",
    priorityScore: 95,
    confidence: 0.96,
    status: "REPORTED",
    peopleAffected: 6,
    injuries: true,
    trapped: true,
    firePresent: false,
    location: {
      lat: 21.0920,
      lng: 79.0620,
      address: "Wardha Road, Sonegaon, Nagpur, Maharashtra",
      accuracy: 4.5
    },
    reportedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    assignedVolunteers: [],
    assignedResources: [],
    auditTimeline: [
      { time: new Date(Date.now() - 15 * 60000).toLocaleTimeString(), event: "Emergency SOS Reported by Citizen", by: "Citizen (Rajesh Deshmukh)" },
      { time: new Date(Date.now() - 14 * 60000).toLocaleTimeString(), event: "AI Classified as Road Accident (Priority: 95/100)", by: "ResQNet AI Engine" }
    ],
    media: [
      { type: "IMAGE", url: "https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=500&auto=format&fit=crop", tag: "Wardha Road Collision" }
    ]
  },
  {
    id: "INC-8902",
    clientUuid: "client-uuid-8902",
    category: "Fire",
    title: "Industrial Storage Fire in Hingna MIDC Phase 2",
    description: "Heavy chemical smoke and visible flames coming from solvent processing plant in Hingna industrial area. 2 workers missing in basement area.",
    severity: "CRITICAL",
    priorityScore: 92,
    confidence: 0.94,
    status: "VERIFIED",
    peopleAffected: 12,
    injuries: true,
    trapped: true,
    firePresent: true,
    location: {
      lat: 21.1210,
      lng: 79.0020,
      address: "MIDC Industrial Area, Hingna Road, Nagpur",
      accuracy: 7.0
    },
    reportedAt: new Date(Date.now() - 42 * 60000).toISOString(),
    assignedVolunteers: [],
    assignedResources: [],
    auditTimeline: [
      { time: new Date(Date.now() - 42 * 60000).toLocaleTimeString(), event: "Reported via Citizen App", by: "Citizen (Sunil Gawande)" },
      { time: new Date(Date.now() - 40 * 60000).toLocaleTimeString(), event: "AI Scored Priority: 92/100 (CRITICAL)", by: "ResQNet AI Engine" },
      { time: new Date(Date.now() - 35 * 60000).toLocaleTimeString(), event: "Incident Verified by Nagpur Fire HQ", by: "Station Officer Kulkarni" }
    ],
    media: [
      { type: "IMAGE", url: "https://images.unsplash.com/photo-1543083477-4f785aeafaa9?w=500&auto=format&fit=crop", tag: "MIDC Industrial Fire" }
    ]
  },
  {
    id: "INC-8903",
    clientUuid: "client-uuid-8903",
    category: "Flood",
    title: "Nag River Overflow - Waterlogging in Sitabuldi Low-lying Area",
    description: "Heavy rains caused Nag river overflow. Water level reached 4 feet near Sitabuldi bridge. Elderly family stranded in ground floor home.",
    severity: "HIGH",
    priorityScore: 78,
    confidence: 0.89,
    status: "ASSIGNED",
    peopleAffected: 5,
    injuries: false,
    trapped: true,
    firePresent: false,
    location: {
      lat: 21.1460,
      lng: 79.0860,
      address: "Sitabuldi Main Road, Near Zero Mile, Nagpur",
      accuracy: 10.0
    },
    reportedAt: new Date(Date.now() - 75 * 60000).toISOString(),
    assignedVolunteers: ["VOL-101"],
    assignedResources: ["RES-302"],
    auditTimeline: [
      { time: new Date(Date.now() - 75 * 60000).toLocaleTimeString(), event: "Nag River Flood Report Submitted", by: "Citizen (Pooja Patil)" },
      { time: new Date(Date.now() - 65 * 60000).toLocaleTimeString(), event: "Command Dispatched Rescue Boat #302", by: "Nagpur Emergency Cell" }
    ],
    media: []
  },
  {
    id: "INC-8904",
    clientUuid: "client-uuid-8904",
    category: "Medical Emergency",
    title: "Cardiac Arrest at Nagpur Railway Station Gate 1",
    description: "58-year-old passenger collapsed near platform entrance. CPR being administered by bystander doctor. AED and ambulance required immediately.",
    severity: "HIGH",
    priorityScore: 84,
    confidence: 0.93,
    status: "RESPONDING",
    peopleAffected: 1,
    injuries: true,
    trapped: false,
    firePresent: false,
    location: {
      lat: 21.1520,
      lng: 79.0890,
      address: "Nagpur Junction Railway Station, Station Road",
      accuracy: 3.0
    },
    reportedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    assignedVolunteers: ["VOL-103"],
    assignedResources: ["RES-301"],
    auditTimeline: [
      { time: new Date(Date.now() - 25 * 60000).toLocaleTimeString(), event: "Medical SOS Triggered", by: "Railway Police Duty Officer" },
      { time: new Date(Date.now() - 20 * 60000).toLocaleTimeString(), event: "ALS Ambulance Unit #301 En-Route", by: "GMC Hospital Dispatch" }
    ],
    media: []
  },
  {
    id: "INC-8905",
    clientUuid: "client-uuid-8905",
    category: "Building Collapse",
    title: "Old Structure Overhang Collapse near Itwari Market",
    description: "Balcony wall of 50-year-old structure collapsed onto busy wholesale lane. 2 pedestrians sustained head and shoulder injuries.",
    severity: "HIGH",
    priorityScore: 81,
    confidence: 0.91,
    status: "VERIFIED",
    peopleAffected: 3,
    injuries: true,
    trapped: false,
    firePresent: false,
    location: {
      lat: 21.1550,
      lng: 79.1120,
      address: "Itwari Grain Market Lane, Central Avenue, Nagpur",
      accuracy: 5.5
    },
    reportedAt: new Date(Date.now() - 90 * 60000).toISOString(),
    assignedVolunteers: [],
    assignedResources: [],
    auditTimeline: [
      { time: new Date(Date.now() - 90 * 60000).toLocaleTimeString(), event: "Structure Collapse Logged", by: "Market Association Member" }
    ],
    media: []
  },
  {
    id: "INC-8906",
    clientUuid: "client-uuid-8906",
    category: "Electrical Emergency",
    title: "Substation Transformer Sparking near Mankapur Chowk",
    description: "MSEDCL distribution transformer sparking heavily after sudden lightning stroke. High voltage wire sagging over road.",
    severity: "MEDIUM",
    priorityScore: 65,
    confidence: 0.88,
    status: "REPORTED",
    peopleAffected: 0,
    injuries: false,
    trapped: false,
    firePresent: true,
    location: {
      lat: 21.1820,
      lng: 79.0780,
      address: "Mankapur Ring Road Chowk, Nagpur",
      accuracy: 4.0
    },
    reportedAt: new Date(Date.now() - 110 * 60000).toISOString(),
    assignedVolunteers: [],
    assignedResources: [],
    auditTimeline: [
      { time: new Date(Date.now() - 110 * 60000).toLocaleTimeString(), event: "Transformer Sparking Reported", by: "Traffic Police Constable" }
    ],
    media: []
  }
];

export const INITIAL_VOLUNTEERS = [
  {
    id: "VOL-101",
    name: "Subhash Wankhede",
    volunteerType: "RESCUE_SQUAD",
    phone: "+91 98230 11223",
    status: "ACTIVE",
    rating: 4.9,
    missionsCount: 38,
    location: { lat: 21.1420, lng: 79.0820 }, // Dharampeth / Sitabuldi
    skills: ["First Aid", "Swimming", "Boat Operation", "CPR"],
    maxRadiusKm: 15.0,
    vehicle: "Bolero 4x4",
    medicalTraining: "Civil Defence Rescue Specialist",
    languages: ["Marathi", "Hindi", "English"],
    availability: "Available Now"
  },
  {
    id: "VOL-102",
    name: "Dr. Anagha Joshi",
    volunteerType: "MEDICAL_RESPONDER",
    phone: "+91 94221 88344",
    status: "ACTIVE",
    rating: 5.0,
    missionsCount: 64,
    location: { lat: 21.1520, lng: 79.0710 }, // Civil Lines
    skills: ["Medical", "Paramedic", "CPR", "Trauma Care", "First Aid"],
    maxRadiusKm: 25.0,
    vehicle: "Emergency Medical Car",
    medicalTraining: "MS General Surgery (GMC Nagpur)",
    languages: ["Marathi", "Hindi", "English"],
    availability: "Available Now"
  },
  {
    id: "VOL-103",
    name: "Pravin Mendhe",
    volunteerType: "RESCUE_SQUAD",
    phone: "+91 98902 44556",
    status: "DISPATCHED",
    rating: 4.8,
    missionsCount: 22,
    location: { lat: 21.1500, lng: 79.0870 }, // Station area
    skills: ["Firefighting", "Search & Rescue", "Driving", "Heavy Lifting"],
    maxRadiusKm: 18.0,
    vehicle: "Pickup Truck",
    medicalTraining: "Basic First Aid",
    languages: ["Marathi", "Hindi"],
    availability: "On Mission (INC-8904)"
  },
  {
    id: "VOL-104",
    name: "Sneha Thakare",
    volunteerType: "RESCUE_SQUAD",
    phone: "+91 97640 12399",
    status: "ACTIVE",
    rating: 4.7,
    missionsCount: 15,
    location: { lat: 21.1000, lng: 79.0550 }, // Wardha Road
    skills: ["Disaster Management", "Crowd Control", "First Aid", "Communication"],
    maxRadiusKm: 12.0,
    vehicle: "Scooter / First Aid Pouch",
    medicalTraining: "First Aid Red Cross Nagpur",
    languages: ["Marathi", "Hindi", "English"],
    availability: "Available Now"
  },
  {
    id: "VOL-105",
    name: "Amitabh Choudhury",
    volunteerType: "MEDIC_RESOURCE_VEHICLE",
    phone: "+91 98224 99001",
    status: "ACTIVE",
    rating: 4.95,
    missionsCount: 45,
    location: { lat: 21.1680, lng: 79.0950 }, // Sadar / Kamptee road
    skills: ["Technical Support", "Generator Repair", "Search & Rescue", "Driving"],
    maxRadiusKm: 20.0,
    vehicle: "Mahindra Pickup",
    medicalTraining: "Basic First Aid",
    languages: ["Marathi", "Hindi", "Bengali"],
    availability: "Available Now"
  }
];

export const INITIAL_RESOURCES = [
  {
    id: "RES-301",
    name: "GMC Hospital ALS Ambulance Unit #1",
    type: "Ambulance",
    capacity: 2,
    status: "DISPATCHED",
    isLiveTracking: true,
    speedKmH: 42,
    location: { lat: 21.1480, lng: 79.0850 }, // Moving near Railway Station
    heading: 45, // degrees
    ownerOrg: "Government Medical College (GMC) Nagpur",
    contactPhone: "+91 712 2740100",
    details: "Advanced Life Support with Cardiac Monitor & Ventilator"
  },
  {
    id: "RES-303",
    name: "Nagpur Fire Brigade Tender Truck #04",
    type: "Fire Truck",
    capacity: 5000, // liters
    status: "AVAILABLE",
    isLiveTracking: true,
    speedKmH: 0,
    location: { lat: 21.1540, lng: 79.0760 }, // Fire Station Civil Lines
    heading: 0,
    ownerOrg: "Nagpur Municipal Corporation (NMC) Fire Dept",
    contactPhone: "101 / +91 712 2531333",
    details: "High-pressure foam monitor with 35m hydraulic ladder"
  },
  {
    id: "RES-304",
    name: "Mobile Heavy Generator Unit (125 kVA)",
    type: "Generator",
    capacity: 125,
    status: "AVAILABLE",
    isLiveTracking: false,
    speedKmH: 0,
    location: { lat: 21.1350, lng: 79.0650 }, // Bajaj Nagar Control Depot
    heading: 0,
    ownerOrg: "NMC Disaster Control Room",
    contactPhone: "+91 712 2567777",
    details: "Diesel heavy-duty mobile generator on 4-wheel trailer"
  },
  {
    id: "RES-305",
    name: "VHA Relief Shelter & Aid Center #01",
    type: "Shelter",
    capacity: 400, // persons
    status: "AVAILABLE",
    isLiveTracking: false,
    speedKmH: 0,
    location: { lat: 21.1390, lng: 79.0720 }, // Ram Nagar Community Hall
    heading: 0,
    ownerOrg: "Vidarbha Relief Association & NMC",
    contactPhone: "+91 712 2541212",
    details: "Stocked with food packets, blankets, clean drinking water, medical desk"
  }
];

export const AI_ACADEMIC_METRICS = {
  modelName: "ResQNet Hybrid NLP Classifier (TF-IDF + Random Forest)",
  datasetSize: 12500, // labeled emergency reports
  trainingSplit: "80% Train / 20% Test",
  accuracy: 94.2,
  precision: 93.8,
  recall: 92.5,
  f1Score: 93.1,
  confusionMatrix: [
    { label: "Fire", truePos: 412, falsePos: 12, falseNeg: 15 },
    { label: "Road Accident", truePos: 580, falsePos: 18, falseNeg: 14 },
    { label: "Medical Emergency", truePos: 620, falsePos: 22, falseNeg: 19 },
    { label: "Flood", truePos: 350, falsePos: 9, falseNeg: 11 },
    { label: "Building Collapse", truePos: 210, falsePos: 8, falseNeg: 7 }
  ],
  featureImportance: [
    { feature: "trapped / stuck", weight: 0.185 },
    { feature: "fire / flames / smoke", weight: 0.162 },
    { feature: "bleeding / unconscious", weight: 0.145 },
    { feature: "collision / crash / flipped", weight: 0.138 },
    { feature: "water level / submerged", weight: 0.112 },
    { feature: "affected headcount", weight: 0.095 }
  ]
};

export const DEMO_SCENARIOS = [
  {
    name: "Scenario 1: Wardha Road Highway Collision",
    category: "Road Accident",
    title: "Passenger Bus & Tanker Collision near Airport Flyover",
    description: "Wardha Road expressway collision. Bus flipped sideways, 15+ passengers screaming, fuel leaking on highway road. Driver unconscious.",
    peopleAffected: 18,
    injuries: true,
    trapped: true,
    firePresent: false,
    lat: 21.0920,
    lng: 79.0620,
    expectedSeverity: "CRITICAL",
    expectedPriority: 96
  },
  {
    name: "Scenario 2: Hingna MIDC Chemical Explosion",
    category: "Fire",
    title: "Explosion at Industrial Solvent Storage in MIDC Phase 2",
    description: "Huge explosion heard 2km away in Hingna MIDC. Massive chemical smoke plume rising. Workers fleeing, multiple severe burn injuries.",
    peopleAffected: 25,
    injuries: true,
    trapped: true,
    firePresent: true,
    lat: 21.1210,
    lng: 79.0020,
    expectedSeverity: "CRITICAL",
    expectedPriority: 98
  },
  {
    name: "Scenario 3: Sitabuldi Nag River Flash Flood",
    category: "Flood",
    title: "Nag River Overflow Traps Residents near Zero Mile",
    description: "Nag river overflowed into residential lanes near Sitabuldi bridge. Water reached 4 feet high rapidly. 10 citizens trapped on balcony.",
    peopleAffected: 10,
    injuries: false,
    trapped: true,
    firePresent: false,
    lat: 21.1460,
    lng: 79.0860,
    expectedSeverity: "HIGH",
    expectedPriority: 88
  }
];
