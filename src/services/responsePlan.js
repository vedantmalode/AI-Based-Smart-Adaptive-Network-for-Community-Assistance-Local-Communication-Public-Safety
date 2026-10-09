const CATEGORY_TASKS = {
  Fire: [
    ['fire_control', 'Contact fire and rescue services', 'Share the incident location, fire status, and any known hazards.'],
    ['evacuate', 'Move people away from the danger area', 'Keep a safe perimeter and follow instructions from emergency responders.'],
    ['injuries', 'Check for injuries from a safe location', 'Tell responders how many people may need medical attention.'],
    ['utilities', 'Report hazardous utilities or materials', 'Flag gas cylinders, chemicals, electrical lines, or blocked access routes.'],
  ],
  'Road Accident': [
    ['medical', 'Request medical and ambulance support', 'Share the number of injured people and any immediate life threats.'],
    ['traffic', 'Secure the road and warn approaching traffic', 'Keep bystanders clear and leave a safe access route for responders.'],
    ['injuries', 'Check casualties without moving them unnecessarily', 'Follow emergency operator instructions and report changes.'],
    ['scene', 'Share vehicle and scene hazards with responders', 'Mention fuel leaks, blocked lanes, or damaged power lines.'],
  ],
  'Medical Emergency': [
    ['ambulance', 'Contact emergency medical services', 'Give the exact location and describe the person’s condition.'],
    ['first_aid', 'Provide only safe first aid', 'Follow dispatcher instructions and avoid moving the person unless there is immediate danger.'],
    ['access', 'Keep the route clear for responders', 'Ask someone to guide the ambulance to the incident location.'],
  ],
  Flood: [
    ['rescue', 'Request water rescue support', 'Report water depth, current, and anyone trapped or missing.'],
    ['evacuate', 'Move people to higher, safer ground', 'Avoid walking or driving through floodwater.'],
    ['utilities', 'Report electrical or structural hazards', 'Keep people away from submerged wires and unstable structures.'],
    ['account', 'Account for affected people', 'Share the number of people who need rescue or shelter.'],
  ],
  Earthquake: [
    ['rescue', 'Request search and rescue support', 'Report damaged structures and anyone believed trapped.'],
    ['medical', 'Request medical support for injured people', 'Share the number and condition of casualties if known.'],
    ['hazards', 'Keep people clear of damaged structures', 'Watch for aftershocks, fire, gas leaks, and fallen power lines.'],
    ['account', 'Account for people in the affected area', 'Give responders the best available headcount and access information.'],
  ],
  'Building Collapse': [
    ['rescue', 'Request specialist search and rescue', 'Share the structure type, collapse details, and possible trapped-person locations.'],
    ['perimeter', 'Keep people clear of the unstable structure', 'Do not enter the building or move debris.'],
    ['medical', 'Request medical support', 'Report known injuries and establish a safe treatment area with responders.'],
    ['hazards', 'Report utilities and secondary hazards', 'Flag gas, electricity, fire, or further structural movement.'],
  ],
  'Gas Leak': [
    ['evacuate', 'Move people away from the suspected leak', 'Do not operate switches or create flames near the affected area.'],
    ['fire', 'Contact fire services and the gas utility', 'Share the location and any symptoms or ignition risks.'],
    ['perimeter', 'Keep a safe perimeter', 'Wait for qualified responders to confirm the area is safe.'],
  ],
  'Electrical Emergency': [
    ['utility', 'Contact the electricity utility and emergency services', 'Give the location and describe any downed wires or sparks.'],
    ['perimeter', 'Keep people away from electrical hazards', 'Treat all wires and nearby water as live until responders confirm otherwise.'],
    ['medical', 'Request medical support if anyone is injured', 'Do not touch a person who may still be in contact with electricity.'],
  ],
};

const DEFAULT_TASKS = [
  ['notify', 'Notify the relevant emergency response team', 'Share the incident type, exact location, and current priority.'],
  ['safety', 'Make the area safer if you can do so safely', 'Keep bystanders away from hazards and leave access open for responders.'],
  ['account', 'Confirm the number of people affected', 'Update responders with any new information about injuries or urgent risks.'],
];

export function createResponsePlan(incident) {
  const tasks = CATEGORY_TASKS[incident.category] || DEFAULT_TASKS;
  return tasks.map(([id, title, guidance]) => ({ id, title, guidance, completed: false }));
}

export function isResponsePlanComplete(incident) {
  return incident?.status === 'RESOLVED'
    || (Array.isArray(incident?.responseTasks)
      && incident.responseTasks.length > 0
      && incident.responseTasks.every((task) => task.completed));
}
