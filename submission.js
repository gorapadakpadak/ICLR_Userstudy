export function prolificIdentity(search) {
  const query = new URLSearchParams(search);
  return Object.fromEntries(["PROLIFIC_PID", "STUDY_ID", "SESSION_ID"].map(key => [key, query.get(key) || ""]));
}

export function connectionProblem(settings, identity) {
  if (!settings.enabled) return "";
  if (!settings.experimentId?.trim()) return "The study is not ready to collect responses. Please contact the researcher on Prolific.";
  try {
    const url = new URL(settings.prolificCompletionUrl);
    if (url.origin !== "https://app.prolific.com" || url.pathname !== "/submissions/complete" || !url.searchParams.get("cc")) throw new Error();
  } catch { return "The study completion link is not configured. Please contact the researcher on Prolific."; }
  if (!Object.values(identity).every(value => /^[a-f0-9]{24}$/i.test(value))) {
    return "Please open this study through Prolific so your participation can be recorded. If this message persists, contact the researcher on Prolific.";
  }
  return "";
}

export async function sendSubmission(experimentId, submission) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch("https://pipe.jspsych.org/api/data/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentID: experimentId, filename: submission.filename, data: submission.data }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if ([201, 202].includes(response.status) && !body.error) {
      return { status: response.status === 202 ? "queued" : "stored", acceptedAt: new Date().toISOString() };
    }
    if (["FILE_EXISTS", "OSF_FILE_EXISTS", "METADATA_ERROR"].includes(body.error)) {
      throw new Error("Your response may already have been received. Download a backup and contact the researcher on Prolific to confirm completion. Do not start a new session.");
    }
    throw new Error(`Submission was not confirmed (${body.error || response.status}). Retry with the same responses, or download a backup and contact the researcher on Prolific.`);
  } catch (error) {
    if (error instanceof TypeError || error.name === "AbortError") {
      throw new Error("The connection was interrupted; receipt could not be confirmed. Keep this page open and retry. If it still fails, download a backup and contact the researcher on Prolific.");
    }
    throw error;
  } finally { clearTimeout(timer); }
}
