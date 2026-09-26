import { sampleCaseIds, sampleModelOrder } from "./assignment.js?v=placement-8";
import { compactPromptView, mountCompactPrompt } from "./timeline.js?v=fixed-event-10";
import { studyCopy } from "./study-copy.js?v=placement-8";
import { eventDetails } from "./event-details.js?v=objects-1";
import { studyConfig as config } from "./study-config.js?v=researcher-9";

import { submissionConfig } from "./submission-config.js?v=datapipe-test-1";
import { prolificIdentity, connectionProblem, sendSubmission } from "./submission.js?v=datapipe-1";

const query = new URLSearchParams(location.search);
const dataPipeTestMode = !submissionConfig.enabled && submissionConfig.testModeEnabled && query.get("DATAPIPE_TEST") === "1";
function testIdentity() {
  const key = "motion-study:datapipe-test-identity";
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Object.values(saved).every((value) => /^[a-f0-9]{24}$/.test(value))) return saved;
    const makeId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (value) => value.toString(16).padStart(2, "0")).join("");
    const created = Object.fromEntries(["PROLIFIC_PID", "STUDY_ID", "SESSION_ID"].map((name) => [name, makeId()]));
    localStorage.setItem(key, JSON.stringify(created));
    return created;
  } catch {
    const fallback = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return Object.fromEntries(["PROLIFIC_PID", "STUDY_ID", "SESSION_ID"].map((name) => [name, fallback()]));
  }
}
const prolific = dataPipeTestMode ? testIdentity() : prolificIdentity(location.search);
const submissionEnabled = submissionConfig.enabled || dataPipeTestMode;
const checkedSubmissionConfig = dataPipeTestMode
  ? { ...submissionConfig, enabled: true, prolificCompletionUrl: "https://app.prolific.com/submissions/complete?cc=TESTMODE" }
  : submissionConfig;
const setupProblem = connectionProblem(checkedSubmissionConfig, prolific);
let submitting = false;
let submissionError = "";
let screen = "intro";

const app = document.querySelector("#app");
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const icon = (name, size = 20) => {
  const paths = {
    play: '<path d="m9 5 11 7-11 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>', back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>', layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
    book: '<path d="M12 6v15m0-15C8 3 4 4 2 5v14c4-2 7-1 10 2 3-3 6-4 10-2V5c-2-1-6-2-10 1Z"/>',
    repeat: '<path d="M4 9a8 8 0 0 1 14-3l3 3m0-6v6h-6M20 15A8 8 0 0 1 6 18l-3-3m0 6v-6h6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.film}</svg>`;
};
const time = (n) => `${Number(n).toFixed(1)}s`;
// Existing study exports use 16 fps; new manifests may specify it explicitly.
const fpsFor = (item = currentCase()) => item.fps ?? 16;
const lastFrame = (item = currentCase()) => (item.frameCount ?? Math.round(item.duration * fpsFor(item))) - 1;
const frameAt = (seconds, item = currentCase()) => Math.max(0, Math.min(lastFrame(item), Math.floor(seconds * fpsFor(item) + 0.00001)));
const eventFirstFrame = (event, item = currentCase()) => frameAt(event.start, item);
const eventLastFrame = (event, item = currentCase()) => frameAt(event.end, item);
const validFrames = (response, item, event = null) => response.action === "absent" || (Number.isInteger(response.startFrame) && Number.isInteger(response.endFrame) && response.startFrame >= (event ? eventFirstFrame(event,item) : 0) && response.startFrame <= response.endFrame && response.endFrame <= (event ? eventLastFrame(event,item) : lastFrame(item)));
const ratingComplete = (response, item, event = null) => ["present", "absent"].includes(response.action) && validSubject(response) && validFrames(response, item, event);
const range = (event) => `${time(event.start)} – ${time(event.end)}`;
const session = () => screen === "guidelines" ? practiceState : state;
const assignedCases = () => screen === "guidelines" ? [practiceCase] : state.caseIds.map((id) => config.cases.find((item) => item.id === id));
const currentCase = () => assignedCases()[session().caseIndex];
const practiceEvents = (item) => item.id === config.practiceCaseId
  ? item.events.filter((event) => config.practiceEventIds?.includes(event.id))
  : item.events;
const ratedEvents = (item = currentCase()) => screen === "guidelines" ? practiceEvents(item) : item.events;
const questionIds = (item = currentCase()) => [...ratedEvents(item).map((event) => event.id), "full"];
const questionIndex = () => questionIds().indexOf(session().questionId);
const totalQuestions = () => assignedCases().reduce((total, item) => total + 1 + ratedEvents(item).length, 0);
const answeredQuestions = () => assignedCases().reduce((total, item) => total + questionCompletion(item), 0);
const displayedModels = (item = currentCase()) => session().modelOrders[item.id].map((id) => config.models.find((model) => model.id === id));
const currentEvent = () => currentCase().events.find((e) => e.id === session().questionId);
const modelLabel = (model, index) => config.blind ? `(${String.fromCharCode(97 + index)})` : model.label;
let disposeMedia = () => {};
let mediaReady = new Set();
let referenceReady = false;
let playing = true;
let storageAvailable = true;
let toastTimer;

function validateConfig() {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const unique = (items, kind) => {
    const ids = items.map((item) => item.id);
    assert(ids.every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]+$/.test(id)), `${kind}: IDs may contain letters, numbers, hyphens, and underscores only.`);
    assert(new Set(ids).size === ids.length, `${kind}: Duplicate IDs found.`);
  };
  assert(config.models?.length === 4, "Specify exactly four models.");
  unique(config.models, "Models");
  assert(config.cases?.length > 0, "At least one evaluation case is required.");
  assert(config.demo || config.practiceCase, "Include the configured practice case in the exported materials.");
  unique(config.cases, "Cases");
  assert(Number.isInteger(config.casesPerParticipant) && config.casesPerParticipant > 0 && config.casesPerParticipant <= config.cases.length, "Check casesPerParticipant.");
  const keys = config.models.map((m) => m.id).sort().join(",");
  for (const item of [...config.cases, ...(config.practiceCase ? [config.practiceCase] : [])]) {
    assert(item.duration > 0 && Number.isFinite(item.duration), `${item.id}: Check the video duration.`);
    assert(item.prompt?.trim() && item.initialFrame, `${item.id}: A prompt and initial frame are required.`);
    assert(item.subjects?.length && item.events?.length, `${item.id}: Subjects and action intervals are required.`);
    unique(item.subjects, `${item.id} subjects`);
    unique(item.events, `${item.id} actions`);
    assert(Object.keys(item.videos || {}).sort().join(",") === keys, `${item.id}: Video model IDs must match the configured models.`);
    for (const model of config.models) {
      assert(typeof item.videos[model.id] === "string", `${item.id}/${model.id}: Video paths must be strings.`);
      assert(config.demo || item.videos[model.id].trim(), `${item.id}/${model.id}: Videos are required outside preview mode.`);
    }
    for (const subject of item.subjects) {
      assert(subject.mask || subject.outlinedFrame, `${item.id}/${subject.id}: A subject mask or outlined frame is required.`);
      assert(!subject.maskMode || ["alpha", "luminance"].includes(subject.maskMode), `${subject.id}: Check maskMode.`);
      assert(/^#[0-9a-fA-F]{6}$/.test(subject.color), `${subject.id}: Specify the color as #RRGGBB.`);
    }
    for (const event of item.events) {
      assert(item.subjects.some((s) => s.id === event.subjectId), `${item.id}/${event.id}: Check the subject ID.`);
      assert(Number.isFinite(event.start) && Number.isFinite(event.end) && event.start >= 0 && event.end > event.start && event.end <= item.duration, `${item.id}/${event.id}: Check the time interval.`);
      assert(event.action?.trim() && event.prompt?.trim(), `${item.id}/${event.id}: An action description and prompt are required.`);
    }
  }
}

// Scope draft storage to the full material manifest, not just case count or positions.
function fingerprint(value) {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}
const signature = fingerprint(JSON.stringify(config));
const storageScope = submissionEnabled ? JSON.stringify([submissionConfig.experimentId, prolific]) : "preview";
const storageKey = `motion-study:${config.id}:${config.version}:${signature}${submissionEnabled ? `:${storageScope}` : ""}`;
const unblindedSignature = fingerprint(JSON.stringify({ ...config, blind: false }));
const unblindedStorageKey = `motion-study:${config.id}:${config.version}:${unblindedSignature}${submissionEnabled ? `:${storageScope}` : ""}`;
function shuffled(values) {
  const ids = [...values];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
function emptyState() {
  const caseIds = sampleCaseIds(config.cases, config.casesPerParticipant, config.caseSamplingWeights, Math.random, config.caseSamplingConstraint);
  return {
    participantId: globalThis.crypto?.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startedAt: new Date().toISOString(), updatedAt: null, completedAt: null,
    caseIds, caseIndex: 0, questionId: questionIds(config.cases.find((item) => item.id === caseIds[0]))[0],
    modelOrders: {}, presentationVersion: "events-first-weighted-leftmost-models-2", answers: {},
  };
}
let state = emptyState();
const exampleSource = config.practiceCase || config.cases.find((item) => item.id === studyCopy.practiceCaseId) || config.cases[0];
const exampleEvent = practiceEvents(exampleSource).find((event) => event.id === studyCopy.practiceEventId) || practiceEvents(exampleSource)[0];
const practiceCase = exampleSource;
const practiceState = { caseIds: [practiceCase.id], caseIndex: 0, questionId: exampleEvent.id, answers: {}, modelOrders: { [practiceCase.id]: sampleModelOrder(config.models.map((model) => model.id), config.modelLeftmostWeights) } };
const eventInfo = (item, event) => ({ action: event.action, objectText: event.objectText || "No specific object / target", objectId: event.objectId ?? null, ...(eventDetails[item.id]?.[event.id] || {}), ...(event.objectText ? { objectText: event.objectText, objectId: event.objectId ?? null } : {}) });

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || (config.blind ? localStorage.getItem(unblindedStorageKey) : null));
    if (saved?.participantId && Array.isArray(saved.caseIds) && saved.caseIds.length === config.casesPerParticipant && new Set(saved.caseIds).size === saved.caseIds.length && saved.caseIds.every((id) => config.cases.some((item) => item.id === id)) && saved.answers && typeof saved.answers === "object" && !Array.isArray(saved.answers)) {
      state = { ...state, ...saved };
      state.caseIndex = Number.isInteger(state.caseIndex) ? Math.max(0, Math.min(assignedCases().length - 1, state.caseIndex)) : 0;
      if (!questionIds().includes(state.questionId)) state.questionId = questionIds()[0];
      // Preserve answers by model ID when upgrading the earlier preference-first draft.
      if (saved.presentationVersion !== "events-first-weighted-leftmost-models-2") {
        state.questionId = unansweredQuestions()[0] || questionIds()[0];
        state.presentationVersion = "events-first-weighted-leftmost-models-2";
      }
    }
  } catch { storageAvailable = false; }
}
function ensureModelOrders() {
  const modelIds = config.models.map((model) => model.id);
  if (!state.modelOrders || typeof state.modelOrders !== "object" || Array.isArray(state.modelOrders)) state.modelOrders = {};
  let previous = practiceState.modelOrders[practiceCase.id];
  for (const caseId of state.caseIds) {
    const order = state.modelOrders[caseId];
    if (!Array.isArray(order) || order.length !== modelIds.length || new Set(order).size !== modelIds.length || !order.every((id) => modelIds.includes(id))) {
      state.modelOrders[caseId] = sampleModelOrder(modelIds, config.modelLeftmostWeights, previous);
    }
    previous = state.modelOrders[caseId];
  }
}
function save() {
  if (screen === "guidelines") return;
  state.updatedAt = new Date().toISOString();
  try { localStorage.setItem(storageKey, JSON.stringify(state)); }
  catch { storageAvailable = false; }
}
function answers(item = currentCase()) {
  return session().answers[item.id] ||= { preference: null, events: {} };
}
function eventAnswers(eventId, modelId, item = currentCase()) {
  const rows = answers(item).events[eventId] ||= {};
  const response = rows[modelId] ||= { action: null, subject: null };
  response.startFrame ??= null;
  response.endFrame ??= null;
  if (response.action === "absent") { response.startFrame = null; response.endFrame = null; }
  return response;
}
const validSubject = (response) => response.action === "absent" ? response.subject === "not_applicable" : ["correct", "incorrect"].includes(response.subject);
function eventComplete(item, event) {
  return config.models.every((m) => {
    const r = eventAnswers(event.id, m.id, item);
    return ratingComplete(r, item, event);
  });
}
function fullComplete(item) { return config.models.some((m) => m.id === answers(item).preference); }
function caseComplete(item) { return fullComplete(item) && ratedEvents(item).every((e) => eventComplete(item, e)); }
function completion() { return assignedCases().filter(caseComplete).length; }
function questionCompletion(item) { return Number(fullComplete(item)) + ratedEvents(item).filter((e) => eventComplete(item, e)).length; }
function unansweredQuestions(item = currentCase()) {
  return questionIds(item).filter((id) => id === "full" ? !fullComplete(item) : !eventComplete(item, item.events.find((event) => event.id === id)));
}
function questionStatusView(item) {
  return `<div class="case-question-progress" aria-label="Question status for this case"><div class="case-progress-heading"><strong>This case</strong><span id="case-answer-count"></span></div><ol class="question-status-list">${questionIds(item).map((id, index) => `<li data-question-status="${id}" ${id === session().questionId ? 'aria-current="step"' : ""}><span class="question-status-icon" aria-hidden="true"></span><span>${id === "full" ? "Preference" : `Event ${index + 1}`}</span><small class="question-status-text"></small></li>`).join("")}</ol></div>`;
}
function toast(message) {
  const node = document.querySelector("#toast");
  if (node) { node.textContent = message; node.classList.add("visible"); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("visible"), 4500); }
  document.querySelector("#announcement").textContent = message;
}

function header() {
  const steps = [["intro", "Introduction"], ["guidelines", "Guidelines"], ["study", "Evaluation"], ["thanks", "Complete"]];
  const active = steps.findIndex(([id]) => id === screen);
  return `<header class="topbar"><nav class="steps" aria-label="Study progress">${steps.map(([id, label], index) => `${index ? '<span class="step-line"></span>' : ""}<span class="step ${index === active ? "active" : index < active ? "done" : ""}"><b>0${index + 1}</b> ${label}</span>`).join("")}</nav></header>`;
}

function render() {
  disposeMedia();
  mediaReady = new Set();
  referenceReady = false;
  app.innerHTML = `${header()}${screen === "intro" ? introView() : screen === "guidelines" ? guidelineView() : screen === "thanks" ? thanksView() : studyView()}<div id="toast" class="toast" role="status"></div>`;
  bindCommon();
  if (screen === "study" || screen === "guidelines") {
    bindStudy();
    mountMedia();
    if (session().questionId !== "full") mountReference();
    refresh();
  }
}
function navigate(next) {
  if (submissionEnabled && setupProblem) next = "intro";
  else if (state.submission && next !== "intro") next = "thanks";
  if (next === "study" && !state.guidelinesCompletedAt) next = "guidelines";
  if (next === "thanks" && completion() !== assignedCases().length) next = "study";
  playing = true;
  screen = next;
  if (next === "study") void uploadAssignment();
  history.replaceState(null, "", `#${next}`);
  render();
  window.scrollTo({ top: 0 });
  document.querySelector("h1")?.focus({ preventScroll: true });
}

function introView() {
  return `<main class="guidelines introduction-page">${dataPipeTestMode ? '<div class="preview-banner"><strong>DataPipe test mode</strong><span>This run will save synthetic test IDs, the model assignment, and your completed responses to the researcher\'s Google Drive.</span></div>' : ""}<div class="eyebrow">ABOUT THIS SURVEY</div><h1 tabindex="-1">${esc(studyCopy.title)}</h1><p class="guide-introduction">${esc(studyCopy.purpose)}</p><div class="intro-facts"><div><span>Estimated time</span><strong>${esc(studyCopy.estimatedTime)}</strong><p>${esc(studyCopy.timeNote)}</p></div><div><span>Your task</span><strong>${config.casesPerParticipant} cases · ${config.models.length} videos per case</strong><p>Event questions, followed by one overall preference question.</p></div></div><section class="guide-section"><h2>What you will do</h2><p>${esc(studyCopy.taskSummary)}</p><div class="intro-question-types">${studyCopy.taskTypes.map(type => `<section><h3>${esc(type.title)}</h3><p>${esc(type.text)}</p></section>`).join("")}</div><p>On the next page, try an example using the same controls as the survey. Complete all practice questions before starting. Practice answers are not part of your responses.</p></section><section class="guide-section"><h2>Before you begin</h2><ol class="intro-precautions">${[...studyCopy.precautions, ...(submissionEnabled ? [ dataPipeTestMode ? "This is a storage test. Synthetic identifiers and your test responses will be sent to DataPipe and Google Drive." : "Your participation ID and video assignment are recorded when you open the survey. Your answers are saved in this browser while you work. At the end, submit your responses, wait for confirmation, then return to Prolific. Your Prolific participant, study, and session IDs are included with your responses."] : [])].map((text) => `<li>${esc(text)}</li>`).join("")}</ol></section><div class="start-panel"><p>${esc(setupProblem || (state.submission ? "Your responses are locked for submission. Continue to check their status." : "First, review the guidelines and example."))}</p><button class="button primary" id="open-guidelines" ${setupProblem ? "disabled" : ""}>${state.submission ? "View submission status" : state.guidelinesCompletedAt ? "Continue evaluation" : "Continue to guidelines"} ${icon("arrow", 17)}</button></div></main>`;
}
function guidelineView() { return studyView(true); }
function guideCriteria(item, event, reference = false) {
  if (!event) return `<section class="walkthrough-rules"><h2>2. Choose your overall preference</h2><p>This question comes after all events in each case. Compare the full videos and select <strong>one</strong> “My preferred video” option. Check whether all requested actions appear without omissions and in the correct order. Also consider visual quality, appearance consistency, and natural motion.</p><p><strong>Read the full prompt:</strong> click a time button below the prompt to highlight the subjects, actions, and targets for that interval. These buttons highlight the prompt and replay the selected time range in all four videos. Select Full video to compare the entire clips.</p><p><strong>Compare the four full videos:</strong> use “Pause”, “Play”, and “Restart” to inspect them, then select your preferred video. Use the full prompt above the four players as your reference.</p><p>Select the video you prefer overall, even if no video is perfect. Within a case, labels (a), (b), (c), and (d) refer to the same videos on every question. ${reference ? "" : "The practice selection below is not saved as a survey response."}</p></section>`;
  const info = eventInfo(item, event);
  const subject = item.subjects.find((subject) => subject.id === event.subjectId);
  return `<section class="walkthrough-rules"><h2>1. Check the event, then rate every video</h2><p>For ${reference ? "this event" : "this example"}, track <strong>${esc(subject.description)}</strong>, the action <strong>${esc(info.action)}</strong>, and the object or target <strong>${esc(info.objectText)}</strong>.</p><p><strong>Read the full prompt:</strong> the words mapped to the event being rated are highlighted. Its requested verb interval is shown directly below the prompt.</p><p><strong>Find the event being rated:</strong> the Target event panel identifies the subject, action, target, and fixed verb interval. The four videos repeat only this interval. Pause or inspect frames inside it to record the first and last visible action frame. Event questions do not switch to another interval or the full video.</p><div class="criteria-grid"><div><h3>Present + Correct</h3><p>The requested action involving the specified object or target is visible, and the outlined subject performs it.</p></div><div><h3>Present + Incorrect</h3><p>The requested action involving that object or target is visible, but a different subject performs it.</p></div><div><h3>Absent</h3><p>The requested action is not visible in the indicated interval, or involves a different object or target. Timing and subject become N/A.</p></div><div><h3>Start / End frame</h3><p>When Present is selected, enter the first and last frames where the action is visible. The inputs use whole-video frame numbers, but are limited to this event’s interval: <strong>${eventFirstFrame(event,item)}–${eventLastFrame(event,item)}</strong>. The end frame is included.</p></div></div><p class="guide-control-tip"><strong>Try the controls below:</strong> pause or drag the slider, move one frame at a time, then use “Use current” to fill a boundary. This illustrates the format; it is not an answer key for these videos.</p><p>Rate only visible evidence in each video. Answer all four models, including timing for Present responses. In the survey, unanswered items block progression.</p></section>`;
}

function studyView(practice = false) {
  const item = currentCase();
  const event = currentEvent();
  const lastQuestion = questionIndex() === questionIds().length - 1;
  const lastCase = session().caseIndex === assignedCases().length - 1;
  return `<main class="study-page">
    ${!practice ? `<button type="button" class="floating-guidelines" id="floating-guidelines" aria-haspopup="dialog">Guidelines</button><dialog id="guidelines-reference" aria-labelledby="reference-guide-title"><div class="reference-guide-heading"><h2 id="reference-guide-title">Guidelines</h2><button type="button" class="button secondary" id="close-guidelines-reference">Close</button></div>${guideCriteria(item, event || item.events[0], true)}${guideCriteria(item, null, true)}</dialog>` : ""}
    <div class="study-heading"><div><div class="eyebrow">${practice ? "PRACTICE EXAMPLE" : `Case ${session().caseIndex + 1} / ${assignedCases().length}`} · Question ${questionIndex() + 1} / ${questionIds().length}</div><h1 tabindex="-1">${practice ? "Guidelines — try an example" : "Video evaluation"}</h1></div>
      <div class="study-progress"><div><span>Answered</span><strong id="overall-count"></strong></div><div class="progress-track"><span id="overall-bar"></span></div></div>
    </div>
    ${practice ? `<div class="practice-banner"><strong>Practice only</strong><span>These responses are separate from the survey and will not be downloaded. Complete every practice event and the preference question. Then select Start evaluation to begin the survey.</span></div>${guideCriteria(item, event)}` : ""}
    <div class="question-overview"><span>For each case: target events first, overall preference last</span><button class="guide-link" id="guide-link">${practice ? (state.guidelinesCompletedAt ? "Return to evaluation" : "Back to introduction") : "View guidelines"}</button></div>
    ${questionStatusView(item)}
    ${config.demo ? '<div class="preview-banner"><strong>Preview</strong><span>Study videos have not been added yet. Responses entered here are for preview only.</span></div>' : ""}
    <section class="evaluation-panel" aria-labelledby="question-title">
      <div class="panel-heading"><div><div class="question-heading-status"><span class="question-label">${event ? `${practice ? `Example event ${questionIndex()+1} of ${ratedEvents(item).length}` : `Event ${questionIndex() + 1} of ${ratedEvents(item).length}`}` : "Overall preference"}</span><span id="current-question-status" class="answer-status" role="status"></span></div><h2 id="question-title">${event ? "Is the action present, and is the subject correct?" : esc(studyCopy.preferenceQuestion)}</h2><p>${event ? "Rate each video. If the action is present, enter its first and last frame using the full-video frame numbers." : "Compare all four full videos. Check that no requested actions are missing and that they occur in the correct order, while considering visual quality, visual consistency, and natural motion."}</p></div><span class="range-badge">${event ? range(event) : "FULL VIDEO"}</span></div>
      ${compactPromptView(config.cases.find(c => c.id === item.id) || item, event)}
      ${event ? eventContext(item, event) : ""}
      <div class="playback-toolbar"><span>${icon("repeat", 14)} <span id="playback-caption">${event ? `Repeating the fixed event interval · ${range(event)}` : "Repeating full video"}</span></span><div>${event ? "" : `<button id="full-video" class="text-button full-video-button" aria-pressed="true" disabled><strong>Full video</strong></button>`}<button id="toggle-play" class="text-button" disabled>${icon("pause", 15)}<span>Pause</span></button><button id="restart" class="text-button" disabled>${icon("repeat", 15)} Restart</button></div></div>
      <div class="video-scroll"><div class="video-grid">${displayedModels(item).map((model, index) => videoCard(item, event, model, index)).join("")}</div></div>
      <div class="panel-bottom-note">${event ? `Judge only the fixed event interval ${range(event)}. Frame controls stay within whole-video frames ${eventFirstFrame(event,item)}–${eventLastFrame(event,item)}. Play and Restart always return to this interval.` : "Select an action interval above to review it, or use Full video to compare the complete clips. Then select your overall preferred video."}</div>
    </section>
    <div class="case-completion-notice" id="case-completion-notice" hidden><p id="case-completion-message" role="status"></p><button class="text-button" id="first-unanswered">Go to first unanswered question ${icon("arrow", 15)}</button></div>
    <div class="evaluation-footer"><div class="save-status" id="save-status"></div><div class="case-navigation"><button class="button secondary" id="prev-question" ${!practice && session().caseIndex === 0 && questionIndex() === 0 ? "disabled" : ""}>${icon("back", 16)} Previous</button><span class="question-position">${practice ? "Practice only" : `Case ${session().caseIndex + 1} of ${assignedCases().length}`}</span><button class="button primary" id="next-question" aria-describedby="case-completion-message">${practice ? (lastQuestion ? "Finish practice" : questionIndex() === questionIds().length-2 ? "Preference example" : "Next question") : lastQuestion ? (lastCase ? "Finish evaluation" : "Next case") : "Next question"}${icon("arrow", 17)}</button></div></div>
  </main>`;
}

function videoCard(item, event, model, index) {
  const label = modelLabel(model, index);
  const source = item.videos[model.id];
  return `<article class="video-card" data-card="${model.id}" aria-label="${esc(label)} evaluation">
    <div class="video-card-heading"><div>${config.blind ? "" : `<span class="model-letter">${String.fromCharCode(65 + index)}</span>`}<strong>${esc(label)}</strong></div>${config.blind ? "" : `<span class="model-size">${esc(model.size)}</span>`}</div>
    <div class="video-surface">${source ? `<video data-model="${model.id}" src="${esc(source)}" muted autoplay playsinline preload="auto" aria-label="${esc(label)} ${event ? range(event) : "Full"} video"></video><div class="media-message">Loading video…</div>` : `<div class="placeholder-overlay"><strong>No video loaded</strong><small>Placeholder</small></div>`}</div>
    <div class="video-time"><span class="time-dot ${source ? "" : "inactive"}"></span><span data-clock="${model.id}">${event ? time(event.start) : "0.0s"}</span><span class="time-total">/ ${time(item.duration)}</span><span class="loop-label">${source ? "LOOP" : "PREVIEW"}</span></div>
    ${event ? `<div class="frame-player" data-frame-player="${model.id}"><div class="frame-player-heading"><strong data-frame-clock="${model.id}">Frame ${eventFirstFrame(event,item)}</strong><span>Event frames ${eventFirstFrame(event,item)}–${eventLastFrame(event,item)} · ${fpsFor(item)} fps</span></div><input type="range" data-frame-seek="${model.id}" min="${eventFirstFrame(event,item)}" max="${eventLastFrame(event,item)}" step="1" value="${eventFirstFrame(event,item)}" aria-label="Seek ${esc(label)} within event frames" disabled/><div class="frame-step-buttons"><button class="text-button" data-frame-step="-1" data-model="${model.id}" disabled>← Previous frame</button><button class="text-button" data-frame-step="1" data-model="${model.id}" disabled>Next frame →</button></div></div><div class="model-answer-status"></div>` : ""}
    ${event ? `<div class="omission-answers"><fieldset><legend>Target action</legend><div class="binary-options">${radio("action", "present", "Present", model.id, event.id)}${radio("action", "absent", "Absent", model.id, event.id)}</div></fieldset>${frameFields(item, event, model)}<fieldset class="subject-field"><legend>Performing subject</legend><div class="binary-options">${radio("subject", "correct", "Correct", model.id, event.id)}${radio("subject", "incorrect", "Incorrect", model.id, event.id)}</div><p class="not-applicable" hidden>Action absent · Subject N/A</p></fieldset></div>` : `<label class="preference-choice"><input type="radio" name="preference" value="${model.id}" ${answers(item).preference === model.id ? "checked" : ""}/><span class="radio-mark"></span><span>My preferred video</span>${icon("check", 16)}</label>`}
  </article>`;
}
function frameFields(item, event, model) {
  const response = eventAnswers(event.id, model.id);
  return `<fieldset class="frame-fields"><legend>Action timing (whole-video frames)</legend><div class="frame-inputs">${["startFrame", "endFrame"].map((field) => `<div><label for="${event.id}-${model.id}-${field}">${field === "startFrame" ? "Start frame" : "End frame"}</label><input id="${event.id}-${model.id}-${field}" type="number" inputmode="numeric" min="${eventFirstFrame(event,item)}" max="${eventLastFrame(event,item)}" step="1" data-frame-field="${field}" data-model="${model.id}" value="${esc(response[field] ?? "")}" placeholder="${eventFirstFrame(event,item)}–${eventLastFrame(event,item)}" aria-describedby="frame-help-${model.id}" disabled/><button class="text-button use-frame" data-use-frame="${field}" data-model="${model.id}" disabled>Use current</button></div>`).join("")}</div><p id="frame-help-${model.id}" class="frame-help"></p></fieldset>`;
}
function radio(field, value, label, modelId, eventId) {
  return `<label class="binary-choice"><input type="radio" name="${eventId}:${modelId}:${field}" data-field="${field}" data-model="${modelId}" value="${value}" ${eventAnswers(eventId, modelId)[field] === value ? "checked" : ""}/><span>${label}</span></label>`;
}
function eventContext(item, event) {
  const subject = item.subjects.find((s) => s.id === event.subjectId);
  const info = eventInfo(item, event);
  const subjectHint = subject.mask ? "Target subject outlined in color" : "Identify the target subject using the description";
  return `<section class="event-context"><div class="reference-block"><div class="context-label">INITIAL FRAME <span style="color:${subject.color}">● ${esc(subject.label)}</span></div><div class="reference-image"><canvas id="reference-canvas" role="img" aria-label="Initial frame: ${esc(subject.description)}"></canvas><span class="reference-caption">${subjectHint}</span></div><p id="reference-status" role="status">Loading subject reference…</p></div><div class="event-description"><div class="context-label">TARGET EVENT <span class="small-range">${range(event)}</span></div><dl class="event-components"><div><dt>Subject</dt><dd><span class="subject-label" style="--subject-color:${subject.color}">${esc(subject.label)}</span> ${esc(subject.description)}</dd></div><div><dt>Action</dt><dd>${esc(info.action)}<span class="action-frame-range">Frames ${eventFirstFrame(event,item)}–${eventLastFrame(event,item)}</span></dd></div><div class="object-component"><dt>Object / target</dt><dd>${esc(info.objectText)}</dd></div></dl><p class="object-instruction">Identify who performs which action, and the object or target involved.</p></div></section>`;
}

function thanksView() {
  const receipt = state.submission?.receipt;
  const online = submissionEnabled;
  const status = receipt ? (receipt.status === "queued" ? "Received · storage pending" : "Submitted successfully") : online ? "Not submitted yet" : storageAvailable ? "Preview · saved locally" : "Download required";
  return `<main class="thanks-page"><h1 tabindex="-1">${receipt ? "Thank you." : online ? "Submit your responses" : "Thank you."}</h1><p class="thanks-description">You have completed all ${assignedCases().length} video sets.</p><div class="completion-receipt"><div><span>Completed</span><strong>${completion()} / ${assignedCases().length} sets ${icon("check", 17)}</strong></div><div><span>Responses</span><strong>${status}</strong></div></div>
    ${online ? receipt ? dataPipeTestMode ? `<p class="download-note">DataPipe test completed. Your test response was saved; no Prolific redirect is used in test mode.</p>` : `<a class="button primary" id="return-prolific" href="${esc(submissionConfig.prolificCompletionUrl)}">Return to Prolific ${icon("arrow", 17)}</a><p class="download-note">${receipt.status === "queued" ? "Your responses have been received. Transfer to the researcher's storage will be retried automatically. You do not need to submit again." : "Your responses have been saved. Return to Prolific to record your completion."}</p>` : `<button class="button primary" id="submit-responses" ${submitting || setupProblem ? "disabled" : ""}>${submitting ? "Submitting… Please wait" : state.submission ? "Retry submission" : "Submit responses"}</button><p class="download-note">Submission locks your answers. Wait for confirmation before returning to Prolific.</p>` : '<p class="download-note">Preview only. Your responses have not been sent to a server.</p>'}
    <p id="submission-message" class="error-text" role="status">${esc(submissionError || setupProblem)}</p>
    <button class="button secondary" id="download">${icon("download", 18)} Download responses</button>
    ${state.submission ? "" : `<button class="text-button review-button" id="review">${icon("back", 16)} Review my responses</button>`}</main>`;
}

async function submitResponses() {
  if (submitting || state.submission?.receipt || !submissionEnabled) return;
  if (setupProblem || !state.guidelinesCompletedAt || completion() !== assignedCases().length || config.demo) {
    submissionError = setupProblem || "Complete the practice and every survey question before submitting.";
    render(); return;
  }
  // Freeze exactly one payload and filename, including on uncertain network retries.
  state.submission ||= {
    filename: `evaluation-${prolific.SESSION_ID}.json`,
    data: JSON.stringify(responsePayload()),
  };
  save(); submitting = true; submissionError = ""; render();
  try {
    state.submission.receipt = await sendSubmission(submissionConfig.experimentId, state.submission);
    save();
  } catch (error) { submissionError = error.message; }
  finally { submitting = false; render(); }
}

function showPracticeComplete() {
  if (screen !== "guidelines" || !caseComplete(practiceCase) || document.querySelector('#practice-complete')) return;
  practiceState.completionShown = true;
  if (playing) document.querySelector('#toggle-play').click();
  app.insertAdjacentHTML('beforeend', `<dialog id="practice-complete" class="practice-complete-dialog" aria-labelledby="practice-complete-title"><div class="practice-success-icon">✓</div><h2 id="practice-complete-title">Well done!</h2><p>Thank you for completing all the practice questions. You are ready to begin the evaluation.</p><p>Your practice answers will not be included in the survey.</p><div class="practice-complete-actions"><button class="button secondary" id="review-practice">Review practice</button><button class="button primary" id="start-evaluation">Start evaluation</button></div></dialog>`);
  const dialog=document.querySelector('#practice-complete');
  dialog.addEventListener('close',()=>dialog.remove());
  document.querySelector('#review-practice').addEventListener('click',()=>dialog.close());
  document.querySelector('#start-evaluation').addEventListener('click',()=>{
    state.guidelinesCompletedAt ||= new Date().toISOString();
    dialog.close();navigate('study');save();
  });
  dialog.showModal();
}

function bindCommon() {
  document.querySelector("#submit-responses")?.addEventListener("click", submitResponses);
  document.querySelector("#open-guidelines")?.addEventListener("click", () => navigate(state.guidelinesCompletedAt ? "study" : "guidelines"));
  document.querySelector("#start")?.addEventListener("click", () => { save(); navigate("study"); });
  document.querySelector("#review")?.addEventListener("click", () => navigate("study"));
  document.querySelector("#download")?.addEventListener("click", download);
}
function bindStudy() {
  const reference = document.querySelector("#guidelines-reference");
  const openReference = () => reference.showModal();
  document.querySelector("#floating-guidelines")?.addEventListener("click", openReference);
  document.querySelector("#close-guidelines-reference")?.addEventListener("click", () => reference.close());
  reference?.addEventListener("click", event => { if (event.target === reference) { const r=reference.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) reference.close(); } });
  document.querySelector("#guide-link").addEventListener("click", () => screen === "study" ? openReference() : navigate(state.guidelinesCompletedAt ? "study" : "intro"));
  document.querySelector("#prev-question").addEventListener("click", () => {
    if (screen === "guidelines") {
      if (questionIndex() === 0) return navigate("intro");
      session().questionId = questionIds()[questionIndex()-1]; return navigate("guidelines");
    }
    moveQuestion(-1);
  });
  document.querySelector("#first-unanswered").addEventListener("click", () => {
    const first = unansweredQuestions()[0];
    if (!first) return;
    session().questionId = first; playing = true; save(); navigate(screen === "guidelines" ? "guidelines" : "study");
  });
  document.querySelector("#next-question").addEventListener("click", () => {
    if (questionIndex() === questionIds().length - 1 && !caseComplete(currentCase())) {
      toast("Answer every question in this case before continuing.");
      return;
    }
    const event = currentEvent();
    if (!(event ? eventComplete(currentCase(), event) : fullComplete(currentCase()))) {
      toast(event ? "Rate all four videos and enter valid start/end frames for each present action before continuing." : "Select your preferred video before continuing.");
      return;
    }
    if (screen === "guidelines") {
      if (session().questionId === "full") return showPracticeComplete();
      session().questionId = questionIds()[questionIndex()+1];
      return navigate("guidelines");
    }
    if (questionIndex() < questionIds().length - 1 || session().caseIndex < assignedCases().length - 1) return moveQuestion(1);
    const missing = assignedCases().findIndex((item) => !caseComplete(item));
    if (missing !== -1) {
      session().caseIndex = missing;
      session().questionId = unansweredQuestions()[0];
      save(); navigate("study");
      toast(`Case ${missing + 1} has unanswered questions.`);
      return;
    }
    session().completedAt = new Date().toISOString(); save(); navigate("thanks");
  });
  document.querySelectorAll("input[data-frame-field]").forEach((input) => input.addEventListener("input", () => {
    const response = eventAnswers(session().questionId, input.dataset.model);
    response[input.dataset.frameField] = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
    session().completedAt = null; save(); refresh();
  }));
  document.querySelectorAll("input[type=radio]").forEach((input) => input.addEventListener("change", () => {
    if (input.name === "preference") answers().preference = input.value;
    else {
      const response = eventAnswers(session().questionId, input.dataset.model);
      response[input.dataset.field] = input.value;
      if (input.dataset.field === "action") {
        if (input.value === "absent") { response.subject = "not_applicable"; response.startFrame = null; response.endFrame = null; }
        else if (response.subject === "not_applicable") response.subject = null;
      }
    }
    session().completedAt = null; save(); refresh();
    if (screen === "guidelines" && session().questionId === "full" && caseComplete(practiceCase) && !practiceState.completionShown) showPracticeComplete();
  }));
}
function moveQuestion(direction) {
  const nextIndex = questionIndex() + direction;
  if (nextIndex < 0) {
    if (session().caseIndex === 0) return;
    session().caseIndex -= 1;
    session().questionId = questionIds().at(-1);
  } else if (nextIndex >= questionIds().length) {
    if (!caseComplete(currentCase())) return;
    if (session().caseIndex >= assignedCases().length - 1) return;
    session().caseIndex += 1;
    session().questionId = questionIds()[0];
  } else {
    session().questionId = questionIds()[nextIndex];
  }
  playing = true; save(); navigate("study");
}

function refresh() {
  if (screen !== "study" && screen !== "guidelines") return;
  const item = currentCase();
  const event = currentEvent();
  const done = answeredQuestions();
  document.querySelector("#overall-count").textContent = `${done} / ${totalQuestions()}`;
  document.querySelector("#overall-bar").style.width = `${done / totalQuestions() * 100}%`;
  const missing = unansweredQuestions(item);
  document.querySelector("#case-answer-count").textContent = `${questionCompletion(item)} / ${questionIds().length} answered`;
  document.querySelectorAll("[data-question-status]").forEach((node) => {
    const complete = !missing.includes(node.dataset.questionStatus);
    const current = node.dataset.questionStatus === session().questionId;
    node.classList.toggle("is-answered", complete);
    node.querySelector(".question-status-icon").innerHTML = complete ? icon("check", 14) : "○";
    node.querySelector(".question-status-text").textContent = `${current ? "Current · " : ""}${complete ? "Answered" : "Unanswered"}`;
  });
  const complete = !missing.includes(session().questionId);
  const ratedModels = event ? config.models.filter((model) => {
    const response = eventAnswers(event.id, model.id);
    return ratingComplete(response, item, event);
  }).length : 0;
  const status = document.querySelector("#current-question-status");
  status.classList.toggle("is-answered", complete);
  status.textContent = complete ? "✓ Answered" : event ? `Unanswered · ${ratedModels} / ${config.models.length} videos rated` : "Unanswered · Select one video";
  const lastQuestion = questionIndex() === questionIds().length - 1;
  document.querySelector("#next-question").disabled = (screen === "guidelines" && !complete) || (lastQuestion && missing.length > 0);
  document.querySelector("#case-completion-notice").hidden = !lastQuestion || !missing.length;
  document.querySelector("#case-completion-message").textContent = lastQuestion && missing.length ? `Complete all questions to continue. Unanswered: ${missing.map((id) => id === "full" ? "Preference" : `Event ${questionIds().indexOf(id) + 1}`).join(", ")}.` : "";
  document.querySelector("#first-unanswered").hidden = missing[0] === session().questionId;
  config.models.forEach((model) => {
    const card = document.querySelector(`[data-card="${model.id}"]`);
    if (!event) {
      const input = card.querySelector("input");
      input.disabled = !config.demo && mediaReady.size !== config.models.length;
      card.classList.toggle("chosen", answers().preference === model.id);
    } else {
      const response = eventAnswers(event.id, model.id);
      const unavailable = !config.demo && (!mediaReady.has(model.id) || !referenceReady);
      card.querySelectorAll("[data-field=action]").forEach((input) => { input.disabled = unavailable; });
      card.querySelectorAll("[data-field=subject]").forEach((input) => {
        input.disabled = unavailable || response.action === "absent";
        input.checked = response.subject === input.value;
      });
      card.querySelectorAll("[data-frame-field]").forEach((input) => {
        input.disabled = unavailable || response.action === "absent";
        input.required = response.action === "present";
        if (response.action === "absent") input.value = "";
        const value = response[input.dataset.frameField];
        const invalid = value !== null && (!Number.isInteger(value) || value < eventFirstFrame(event,item) || value > eventLastFrame(event,item) || (response.startFrame !== null && response.endFrame !== null && response.startFrame > response.endFrame));
        input.setAttribute("aria-invalid", String(invalid));
      });
      card.querySelectorAll("[data-use-frame]").forEach((button) => { button.disabled = unavailable || response.action === "absent"; });
      const help = card.querySelector(".frame-help");
      help.textContent = response.action === "absent" ? "Action absent · Timing N/A" : response.action !== "present" ? `You may enter timing now. If you select Present, both frames are required within ${eventFirstFrame(event,item)}–${eventLastFrame(event,item)}.` : validFrames(response, item, event) ? `Frames ${response.startFrame}–${response.endFrame} (inclusive)` : `Enter whole-video frames inside this event: ${eventFirstFrame(event,item)} ≤ start ≤ end ≤ ${eventLastFrame(event,item)}. Both are required.`;
      card.querySelector(".frame-fields").classList.toggle("is-na", response.action === "absent");
      card.querySelector(".subject-field").classList.toggle("is-na", response.action === "absent");
      card.querySelector(".not-applicable").hidden = response.action !== "absent";
      card.classList.toggle("answered", ratingComplete(response, item, event));
      card.querySelector(".model-answer-status").textContent = card.classList.contains("answered") ? "✓ Answered" : "○ Unanswered";
    }
  });
  document.querySelector("#save-status").innerHTML = `${icon(storageAvailable ? "check" : "download", 16)}<span>${screen === "guidelines" ? "Practice responses only · Not included in your survey" : storageAvailable ? "Responses saved in this browser" : "Browser storage unavailable. Download your responses when finished."}</span>`;
}

function mountMedia() {
  const videos = [...document.querySelectorAll("video")];
  const event = currentEvent();
  const item = currentCase();
  const timelineItem = config.cases.find(c => c.id === item.id) || item;
  let start = event?.start || 0;
  let end = event ? Math.min(item.duration, event.end + 1 / fpsFor(item)) : item.duration;
  let disposed = false;
  let frame;
  const blocked = new Set();
  const promptControl = mountCompactPrompt(timelineItem, event, event ? null : segment => setRange(segment.start,segment.end));
  const rangeCaption = () => event ? `Repeating the fixed event interval · ${range(event)}` : start===0 && end===item.duration ? "Repeating full video" : `Repeating ${start.toFixed(2)}–${end.toFixed(2)}s`;
  function setRange(nextStart,nextEnd) {
    start=nextStart;end=nextEnd;playing=true;blocked.clear();
    videos.forEach(video=>{if(mediaReady.has(video.dataset.model)){video.currentTime=start;play(video);}});
    document.querySelector('#playback-caption').textContent=rangeCaption();
    updateToolbar();
  }
  document.querySelector('#full-video')?.addEventListener('click',()=>{promptControl.full();setRange(0,item.duration);});
  function updateToolbar() {
    if (disposed) return;
    const button = document.querySelector("#toggle-play");
    button.disabled = !mediaReady.size;
    document.querySelector("#restart").disabled = !mediaReady.size;
    const fullButton=document.querySelector("#full-video");
    if (fullButton) { fullButton.disabled = !mediaReady.size; fullButton.setAttribute('aria-pressed',String(start===0 && end===item.duration)); }
    document.querySelectorAll("[data-frame-seek], [data-frame-step]").forEach((control) => {
      control.disabled = !mediaReady.has(control.dataset.model || control.dataset.frameSeek);
    });
    button.innerHTML = `${icon(playing && !blocked.size ? "pause" : "play", 15)}<span>${playing && !blocked.size ? "Pause" : "Play"}</span>`;
  }
  function seekFrame(modelId, target) {
    const video = videos.find((v) => v.dataset.model === modelId);
    if (!video || !mediaReady.has(modelId)) return;
    playing = false; blocked.clear(); videos.forEach((v) => v.pause());
    // Seek inside the frame to avoid floating-point boundaries displaying its predecessor.
    const minimum=event ? eventFirstFrame(event,item) : 0;
    const maximum=event ? eventLastFrame(event,item) : lastFrame(item);
    video.currentTime = (Math.max(minimum, Math.min(maximum, target)) + 0.01) / fpsFor(item);
    document.querySelector("#playback-caption").textContent = event ? `Paused · Inspecting event frames ${minimum}–${maximum}` : "Paused · Inspecting frames across the full video";
    updateToolbar();
  }
  document.querySelectorAll("[data-frame-seek]").forEach((input) => input.addEventListener("input", () => seekFrame(input.dataset.frameSeek, Number(input.value))));
  document.querySelectorAll("[data-frame-step]").forEach((button) => button.addEventListener("click", () => {
    const video = videos.find((v) => v.dataset.model === button.dataset.model);
    seekFrame(button.dataset.model, frameAt(video.currentTime, item) + Number(button.dataset.frameStep));
  }));
  document.querySelectorAll("[data-use-frame]").forEach((button) => button.addEventListener("click", () => {
    const video = videos.find((v) => v.dataset.model === button.dataset.model);
    seekFrame(button.dataset.model, frameAt(video.currentTime, item));
    const input = document.querySelector(`[data-frame-field="${button.dataset.useFrame}"][data-model="${button.dataset.model}"]`);
    input.value = frameAt(video.currentTime, item);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }));
  function play(video) {
    if (disposed || !playing || !mediaReady.has(video.dataset.model)) return;
    video.play()?.then(() => { blocked.delete(video.dataset.model); updateToolbar(); }).catch((error) => {
      if (disposed || error.name === "AbortError") return;
      blocked.add(video.dataset.model); updateToolbar();
      document.querySelector("#playback-caption").textContent = "Select Play to start the videos";
    });
  }
  videos.forEach((video) => {
    video.muted = true;
    const message = video.parentElement.querySelector(".media-message");
    const fail = (text) => {
      mediaReady.delete(video.dataset.model); video.pause(); message.hidden = false; message.textContent = text; refresh(); updateToolbar();
    };
    video.addEventListener("loadedmetadata", () => {
      if (disposed) return;
      if (!Number.isFinite(video.duration) || video.duration + 0.1 < item.duration) return fail("The video is shorter than the configured evaluation interval.");
      if (!event) video.closest(".video-card").querySelector(".time-total").textContent = `/ ${time(video.duration)}`;
      video.currentTime = start;
    });
    video.addEventListener("loadeddata", () => {
      if (disposed || !Number.isFinite(video.duration) || video.duration + 0.1 < item.duration) return;
      mediaReady.add(video.dataset.model); message.hidden = true; refresh(); updateToolbar();
      if (video.currentTime < start || video.currentTime >= end) video.currentTime = start;
      if (!playing) video.pause(); else play(video);
    });
    video.addEventListener("error", () => { if (!disposed) fail("Unable to load the video. Check the file and path."); });
    video.addEventListener("ended", () => { if (!disposed && playing && mediaReady.has(video.dataset.model)) { video.currentTime = start; play(video); } });
  });
  function tick() {
    if (disposed) return;
    for (const video of videos) {
      if (!mediaReady.has(video.dataset.model)) continue;
      const boundaryEnd = end;
      if (playing && !video.seeking && (video.currentTime >= boundaryEnd || video.currentTime < start - 0.04)) {
        video.currentTime = start;
        if (playing) play(video);
      }
      document.querySelector(`[data-clock="${video.dataset.model}"]`).textContent = time(video.currentTime);
      if (event) {
        const currentFrame = frameAt(video.currentTime, item);
        document.querySelector(`[data-frame-clock="${video.dataset.model}"]`).textContent = `Frame ${currentFrame}`;
        document.querySelector(`[data-frame-seek="${video.dataset.model}"]`).value = currentFrame;
      }
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  document.querySelector("#toggle-play").addEventListener("click", () => {
    playing = !playing || blocked.size > 0;
    blocked.clear();
    videos.forEach((video) => playing ? play(video) : video.pause()); updateToolbar();
    document.querySelector("#playback-caption").textContent = playing ? rangeCaption() : "Paused";
  });
  document.querySelector("#restart").addEventListener("click", () => {
    playing = true; blocked.clear();
    videos.forEach((video) => { if (mediaReady.has(video.dataset.model)) { video.currentTime = start; play(video); } });
    document.querySelector("#playback-caption").textContent = rangeCaption();
    updateToolbar();
  });
  disposeMedia = () => { disposed = true; cancelAnimationFrame(frame); videos.forEach((video) => { video.pause(); video.removeAttribute("src"); video.load(); }); };
}

function loadImage(src) {
  return new Promise((resolve, reject) => { const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error("Check the image path and access permissions.")); image.src = src; });
}
async function mountReference() {
  const canvas = document.querySelector("#reference-canvas");
  const status = document.querySelector("#reference-status");
  const item = currentCase();
  const subject = item.subjects.find((s) => s.id === currentEvent().subjectId);
  try {
    const [initial, mask] = await Promise.all([loadImage(subject.outlinedFrame || item.initialFrame), subject.outlinedFrame ? Promise.resolve(null) : loadImage(subject.mask)]);
    if (!canvas.isConnected) return;
    const scale = Math.min(1, 1000 / initial.naturalWidth);
    canvas.width = Math.round(initial.naturalWidth * scale); canvas.height = Math.round(initial.naturalHeight * scale);
    const context = canvas.getContext("2d");
    context.drawImage(initial, 0, 0, canvas.width, canvas.height);
    if (mask) {
      if (Math.abs(mask.naturalWidth / mask.naturalHeight - initial.naturalWidth / initial.naturalHeight) > 0.01) throw new Error("The initial frame and mask have different aspect ratios.");
      const maskCanvas = document.createElement("canvas");
      maskCanvas.width = canvas.width; maskCanvas.height = canvas.height;
      const ctx = maskCanvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
      const w = canvas.width, h = canvas.height;
      const pixels = ctx.getImageData(0, 0, w, h).data;
      const binary = new Uint8Array(w * h);
      for (let i = 0; i < binary.length; i++) binary[i] = subject.maskMode === "alpha" ? Number(pixels[i * 4 + 3] > 127) : Number(pixels[i * 4 + 3] > 127 && (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3 > 127);
      if (!binary.some(Boolean) || binary.every(Boolean)) throw new Error("No valid subject region found in the mask. Check maskMode.");
      const outline = ctx.createImageData(w, h);
      const rgb = subject.color.slice(1).match(/../g).map((v) => parseInt(v, 16));
      const radius = Math.max(2, Math.round(w / 220));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!binary[i]) continue;
        const edge = x < radius || y < radius || x >= w - radius || y >= h - radius || !binary[i - radius] || !binary[i + radius] || !binary[i - radius * w] || !binary[i + radius * w];
        if (edge) { outline.data.set([...rgb, 255], i * 4); }
      }
      ctx.putImageData(outline, 0, 0); context.drawImage(maskCanvas, 0, 0);
    }
    referenceReady = true; status.textContent = `${subject.label} · ${subject.description}`; refresh();
  } catch (error) {
    if (!canvas.isConnected) return;
    status.textContent = `Unable to load the subject reference. ${error.message}`; status.classList.add("error-text"); referenceReady = false; refresh();
  }
}


// A frozen allocation sidecar records blinded labels even when the participant drops out.
function labelAnswerKey() {
  return state.caseIds.map(caseId => ({caseId, labels: state.modelOrders[caseId].map((modelId,i) => ({label:`(${String.fromCharCode(97+i)})`, position:i+1, modelId, modelName:config.models.find(m=>m.id===modelId).label}))}));
}
let assignmentUploading = false;
async function uploadAssignment() {
  if (!submissionEnabled || setupProblem || assignmentUploading || state.assignmentSubmission?.receipt) return;
  if (!state.assignmentSubmission) {
    const payload = {trial_type:"assignment", schemaVersion:6, recordType:"assignment", submissionMode:dataPipeTestMode ? "datapipe-test" : "datapipe", studyId:config.id, studyVersion:config.version, materialsRevision:config.materialsRevision, manifestFingerprint:signature, participantId:state.participantId, prolific, assignedAt:state.startedAt, labelAnswerKey:labelAnswerKey()};
    state.assignmentSubmission = {filename:`assignment-${prolific.SESSION_ID}.json`, data:JSON.stringify(payload), receipt:null};
  }
  // save() deliberately ignores practice answers, but this record belongs to the main state.
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} };
  persist(); assignmentUploading=true;
  try { state.assignmentSubmission.receipt = await sendSubmission(submissionConfig.experimentId, state.assignmentSubmission); state.assignmentSubmission.error=null; }
  catch(error) { state.assignmentSubmission.error=error.message; }
  finally { assignmentUploading=false; persist(); }
}

function responsePayload() {
  return {
    trial_type: "response",
    schemaVersion: 6,
    recordType: "response",
    prolific: submissionEnabled ? prolific : null,
    submissionMode: dataPipeTestMode ? "datapipe-test" : submissionConfig.enabled ? "datapipe" : "preview", studyId: config.id, studyVersion: config.version, materialsRevision: config.materialsRevision, manifestFingerprint: signature,
    demo: config.demo, blind: config.blind, participantId: session().participantId,
    startedAt: session().startedAt, completedAt: session().completedAt, exportedAt: new Date().toISOString(),
    assignment: { method: "weighted-random-without-replacement", algorithm: "sequential-proportional-weights-with-group-cap", groupConstraint: config.caseSamplingConstraint, presentationOrder: "uniform-random", caseWeights: Object.fromEntries(config.cases.map(item => [item.id, config.caseSamplingWeights?.[item.id] ?? 1])), casePoolIds: config.cases.map((item) => item.id), caseIds: session().caseIds, casesPerParticipant: config.casesPerParticipant },
    instructionsVersion: "complete-actions-intro-balanced-cases-8",
    practiceCaseId: config.practiceCaseId, guidelinesCompletedAt: state.guidelinesCompletedAt || null,
    timelineVersion: "prompt-highlights-only-5",
    modelLabelFormat: "lowercase-parentheses",
    promptMappingVersion: "exact-spans-1",
    frameConvention: { indexBase: 0, endInclusive: true, origin: "full-video", absentValue: null },
    presentationVersion: session().presentationVersion,
    questionOrder: "events-then-preference", modelOrderMethod: "weighted-leftmost-random-per-case-fixed-within-case",
    modelPlacement: { firstPositionWeights: Object.fromEntries(config.models.map(model=>[model.id,config.modelLeftmostWeights?.[model.id]??1])), avoidPreviousPermutation: true },
    preferenceCriterion: studyCopy.preferenceCriterion,
    preferenceQuestion: studyCopy.preferenceQuestion,
    models: config.models,
    labelAnswerKey: labelAnswerKey(),
    assignmentReceipt: state.assignmentSubmission?.receipt || null,
    cases: assignedCases().map((item) => ({
      caseId: item.id, fps: fpsFor(item), frameCount: lastFrame(item) + 1, modelDisplayOrder: session().modelOrders[item.id], labelToModel: Object.fromEntries(session().modelOrders[item.id].map((id,i)=>[`(${String.fromCharCode(97+i)})`,id])), questionIds: questionIds(item), prompt: item.prompt, duration: item.duration, videos: item.videos,
      preference: { selectedModelId: answers(item).preference },
      events: item.events.map((event) => ({
        eventId: event.id, subjectId: event.subjectId, start: event.start, end: event.end,
        action: event.action, objectId: eventInfo(item, event).objectId, objectText: eventInfo(item, event).objectText, displayedAction: eventInfo(item, event).action, prompt: event.prompt,
        ratings: config.models.map((model) => ({ modelId: model.id, ...eventAnswers(event.id, model.id, item) })),
      })),
    })),
  };
}

function download() {
  const payload = state.submission ? JSON.parse(state.submission.data) : responsePayload();
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = state.submission?.filename || `${config.demo ? "DEMO-" : ""}evaluation-${session().participantId}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Response file download started.");
}

try {
  validateConfig(); restore(); ensureModelOrders();
  if (completion() !== assignedCases().length) session().completedAt = null;
  save();
  const reloaded = performance.getEntriesByType("navigation")[0]?.type === "reload";
  const requested = reloaded ? "intro" : location.hash.slice(1);
  if (reloaded) history.replaceState(null, "", "#intro");
  if (requested === "study") screen = state.guidelinesCompletedAt ? "study" : "guidelines";
  if (requested === "guidelines") screen = "guidelines";
  if (requested === "thanks" && completion() === assignedCases().length && session().completedAt) screen = "thanks";
  if (submissionEnabled && setupProblem) screen = "intro";
  else if (state.submission && screen !== "intro") screen = "thanks";
  render();
  void uploadAssignment();
} catch (error) {
  app.innerHTML = `<main class="config-error"><h1>Check the evaluation settings.</h1><p>${esc(error.message)}</p><p>Update study-config.js, then reload the page.</p></main>`;
}
