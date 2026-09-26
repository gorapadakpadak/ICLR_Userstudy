// Edit participant-facing introduction text here, then copy to ../Userstudy/study-copy.js.
// The duration is a provisional estimate; replace it after piloting the survey.
export const studyCopy = {
  title: "Video generation evaluation",
  purpose: "Our goal is to generate videos that include every action described in a text prompt in the intended order, without omitting actions, while also maintaining visual quality and natural motion.",
  estimatedTime: "Approximately 15–20 minutes",
  timeNote: "The time may vary depending on how often you replay the videos.",
  preferenceQuestion: "Which video best depicts all the requested actions in the correct order, without omissions, while maintaining visual quality and natural motion?",
  preferenceCriterion: "Completeness of requested actions, correct action order, visual quality, visual consistency, and natural motion",
  taskSummary: "You will evaluate 2 cases, each with 4 generated videos. The survey has two types of questions:",
  taskTypes: [
    { title: "1. Event evaluation", text: "For each question, the target time range, the action to be generated, and the subject who should perform it are shown above the videos. For each video below, judge whether the action is visible. If it is, enter the first and last frames where it occurs, and indicate whether the correct subject performs it. Judge only what you can see in the video." },
    { title: "2. Overall preference", text: "After the event questions, choose the video that best includes all actions described in the text prompt without omissions and in the intended order, while maintaining visual quality and natural motion." },
  ],
  precautions: [
    "Use a desktop or laptop with a screen large enough to compare the videos comfortably.",
    "Wait for all videos to load. You may replay them, pause, and inspect individual frames as often as needed. Audio is not needed.",
    "Judge what is visible. Check the action, its object or interaction target, and the person or animal performing it.",
    "Complete every event question and the final preference question before continuing to the next case. You can return to earlier questions to revise your answers.",
  ],
  practiceCaseId: "-9kDwdxVlEw_04841_D_seg01__add",
  practiceEventId: "s1-2",
};
