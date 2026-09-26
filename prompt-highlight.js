import { promptMap } from './prompt-map.js?v=prompt-1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function highlightedPrompt(item, events) {
  const map = promptMap[item.id];
  if (!map || map.prompt !== item.prompt) return { html: escape(item.prompt), mapped: false };
  const spans = events.flatMap(event => [...(map.events[event.id] || []), ...(map.subjects[event.subjectId] ? [map.subjects[event.subjectId]] : [])].map(span => ({...span, subjectId:event.subjectId})));
  const valid = spans.filter(span => item.prompt.slice(span.start,span.end) === span.text);
  const boundaries = [...new Set([0,item.prompt.length,...valid.flatMap(span=>[span.start,span.end])])].sort((a,b)=>a-b);
  return {mapped: valid.length > 0, html: boundaries.slice(0,-1).map((start,i) => {
    const end=boundaries[i+1], text=escape(item.prompt.slice(start,end));
    const subjects=[...new Set(valid.filter(span=>span.start<=start && span.end>=end).map(span=>span.subjectId))];
    if (!subjects.length) return text;
    const color=subjects.length===1 ? item.subjects.find(s=>s.id===subjects[0]).color : '#6875ac';
    return `<mark style="--highlight-color:${color}" data-prompt-subjects="${subjects.join(' ')}">${text}</mark>`;
  }).join('')};
}

export function promptView(item, help = "Choose a time range to highlight its subjects, actions, and targets and replay that part of all four videos. Use Full video to replay the entire clip.") {
  return `<section class="sequence-prompt" aria-labelledby="full-prompt-title"><div class="sequence-prompt-heading"><h2 id="full-prompt-title">Full text prompt</h2></div><p class="sequence-full-text" id="sequence-full-prompt" lang="en">${escape(item.prompt)}</p><div class="prompt-subject-key">${item.subjects.map(subject=>`<span><i style="background:${subject.color}"></i>${escape(subject.label)} · ${escape(subject.description)}</span>`).join('')}</div><p class="prompt-selection-help">${escape(help)}</p></section>`;
}

export function bindPromptIntervals(item, segments, current, onSelect) {
  const buttons=[...document.querySelectorAll('[data-prompt-segment]')];
  const text=document.querySelector('#sequence-full-prompt');
  function highlight(events,index=-1) {
    text.innerHTML=highlightedPrompt(item,events).html;
    buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  }
  buttons.forEach((button,index)=>button.addEventListener('click',()=>{
    highlight(segments[index].events,index);
    onSelect?.(segments[index]);
  }));
  const initial=segments.findIndex(segment=>current && segment.start===current.start && segment.end===current.end);
  highlight(current ? initial>=0 ? segments[initial].events : [current] : item.events,initial);
  return { full:()=>highlight(item.events) };
}
