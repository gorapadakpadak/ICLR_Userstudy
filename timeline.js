import { promptView, bindPromptIntervals } from './prompt-highlight.js?v=fixed-event-10';

export function timelineSegments(item) {
  const boundaries=[...new Set([0,item.duration,...item.events.flatMap(e=>[e.start,e.end])])].sort((a,b)=>a-b);
  return boundaries.slice(0,-1).map((start,i)=>({start,end:boundaries[i+1],events:item.events.filter(e=>e.start<boundaries[i+1] && e.end>start)})).filter(segment=>segment.events.length);
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function actionList(item, segment) {
  return segment.events.map(event => {
    const subject=item.subjects.find(s=>s.id===event.subjectId);
    return `<span><i style="background:${subject?.color || '#6875ac'}"></i><strong>${escape(subject?.label || event.subjectId)}</strong> · ${escape(event.action)}</span>`;
  }).join('');
}

export function compactPromptView(item, event = null) {
  if (event) {
    const subject=item.subjects.find(s=>s.id===event.subjectId);
    return `<section class="compact-prompt-panel event-prompt-panel">${promptView(item, "The prompt highlights only the event being rated below. Playback is fixed to its requested interval.")}<div class="fixed-event-interval" data-event-start="${event.start}" data-event-end="${event.end}"><span>Event interval</span><strong>${event.start.toFixed(2)}–${event.end.toFixed(2)}s</strong><p><i style="background:${subject?.color || '#6875ac'}"></i>${escape(subject?.label || event.subjectId)} · ${escape(event.action)}</p></div></section>`;
  }
  return `<section class="compact-prompt-panel preference-prompt-panel">${promptView(item, "Choose an interval to highlight the matching words and replay that part. Each button lists the actions requested in that interval. Use Full video to return to the complete clip.")}<div class="prompt-interval-controls" role="group" aria-label="Choose a requested action interval">${timelineSegments(item).map((segment,index)=>`<button type="button" class="prompt-interval-button" data-prompt-segment="${index}" data-start="${segment.start}" data-end="${segment.end}" aria-pressed="false" aria-controls="sequence-full-prompt"><b>${segment.start.toFixed(2)}–${segment.end.toFixed(2)}s</b><span class="interval-actions">${actionList(item,segment)}</span></button>`).join('')}</div></section>`;
}

export function mountCompactPrompt(item, current, onSelect) {
  return bindPromptIntervals(item,timelineSegments(item),current,onSelect);
}
