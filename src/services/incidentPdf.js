function cleanText(value) {
  return String(value ?? 'Not recorded')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Not recorded';
}

function escapePdfText(value) {
  return cleanText(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function wrapText(value, width = 88) {
  const words = cleanText(value).split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if (current && `${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  });
  if (current) lines.push(current);
  return lines.length ? lines : ['Not recorded'];
}

function makePdf(lines) {
  const pageSize = 48;
  const pages = [];
  for (let start = 0; start < lines.length; start += pageSize) pages.push(lines.slice(start, start + pageSize));
  const objects = new Map();
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pages.forEach((pageLines, pageIndex) => {
    const pageId = pageIds[pageIndex];
    const contentId = pageId + 1;
    const commands = pageLines.map((line, lineIndex) => {
      const y = 752 - lineIndex * 14;
      const size = lineIndex === 0 && pageIndex === 0 ? 16 : 10;
      return `BT /F1 ${size} Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET`;
    }).join('\n');
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  const maxObjectId = 3 + pages.length * 2;
  for (let id = 1; id <= maxObjectId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxObjectId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadIncidentPdf(incident, volunteers = [], resources = [], tasks = []) {
  const assignedVolunteers = (incident.assignedVolunteers || []).map((id) => volunteers.find((item) => item.id === id));
  const assignedResources = (incident.assignedResources || []).map((id) => resources.find((item) => item.id === id));
  const coords = Number.isFinite(incident.location?.lat) && Number.isFinite(incident.location?.lng)
    ? `${incident.location.lat}, ${incident.location.lng}`
    : 'Not recorded';
  const lines = [];
  const add = (label, value) => {
    wrapText(`${label}: ${value}`).forEach((line) => lines.push(line));
  };
  const section = (title) => { lines.push(''); lines.push(title.toUpperCase()); };

  lines.push('INCIDENT COMPLETION REPORT');
  add('Incident ID', incident.id);
  add('Category', incident.category);
  add('Lifecycle status', incident.status);
  add('Severity and priority', `${incident.severity || 'Unrated'} · ${incident.priorityScore ?? 'Not recorded'}/100`);
  add('Reported at', incident.reportedAt ? new Date(incident.reportedAt).toLocaleString() : 'Not recorded');
  const completionTimes = tasks.map((task) => task.completedAt).filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  add('Response checklist completed at', completionTimes.length ? new Date(Math.max(...completionTimes)).toLocaleString() : 'Not recorded');
  add('Location', incident.location?.address);
  add('Coordinates', coords);
  add('People affected', incident.peopleAffected);
  add('Injuries reported', incident.injuries ? 'Yes' : 'No');
  add('Trapped people reported', incident.trapped ? 'Yes' : 'No');
  add('Fire reported', incident.firePresent ? 'Yes' : 'No');
  section('Incident description');
  lines.push(...wrapText(incident.description));
  section('AI triage');
  add('Priority band', incident.priorityBand);
  add('AI confidence', Number.isFinite(incident.confidence) ? `${Math.round(incident.confidence * 100)}%` : 'Not recorded');
  add('Triage explanation', incident.explanation || incident.priorityReason);
  add('Suggested resources', (incident.recommendedResources || []).join(', '));
  section('Assigned volunteers');
  if (!assignedVolunteers.length) lines.push('None assigned');
  assignedVolunteers.forEach((item, index) => add(`Volunteer ${index + 1}`, item ? `${item.name} (${item.id}) · ${item.status || 'Status unavailable'}` : `Record ${incident.assignedVolunteers[index]} · details unavailable`));
  section('Assigned ambulance and resources');
  if (!assignedResources.length) lines.push('None assigned');
  assignedResources.forEach((item, index) => add(`Resource ${index + 1}`, item ? `${item.name} (${item.id}) · ${item.type || 'Resource'} · ${item.status || 'Status unavailable'}` : `Record ${incident.assignedResources[index]} · details unavailable`));
  section('Response checklist');
  if (!tasks.length) lines.push('No checklist tasks recorded');
  tasks.forEach((task, index) => add(`Task ${index + 1} · ${task.completed ? 'COMPLETE' : 'OPEN'}`, `${task.title}${task.completedAt ? ` · completed ${new Date(task.completedAt).toLocaleString()}` : ''}${task.completedBy ? ` by ${task.completedBy}` : ''}. ${task.guidance || ''}`));
  section('Audit timeline');
  if (!(incident.auditTimeline || []).length) lines.push('No timeline events recorded');
  (incident.auditTimeline || []).forEach((event) => add(event.at ? new Date(event.at).toLocaleString() : event.time || 'Time unavailable', `${event.event || 'Incident update'} · ${event.by || 'User unavailable'}`));
  section('Evidence');
  if (!(incident.media || []).length) lines.push('No evidence attachments recorded');
  (incident.media || []).forEach((media, index) => add(`Attachment ${index + 1}`, `${media.type || 'File'} · ${media.name || media.tag || 'Evidence'}`));
  lines.push('', 'Generated by the AI-Based incident response system.');

  const pdf = makePdf(lines);
  const url = URL.createObjectURL(pdf);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${cleanText(incident.id).replace(/[^a-zA-Z0-9_-]/g, '_') || 'incident'}-report.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
