export function buildInterviewSystemPrompt(params: {
  jobTitle: string;
  company?: string;
  type: "behavioral" | "technical" | "case";
}): string {
  const typeInstructions = {
    behavioral: "Ask behavioral questions using the STAR method. Focus on leadership, teamwork, conflict resolution, and problem-solving.",
    technical: "Ask technical questions relevant to the role. Include coding concepts, system design, and domain-specific knowledge.",
    case: "Present business case studies relevant to the role. Ask the candidate to analyze situations and propose solutions.",
  };

  return `You are an experienced interviewer conducting a ${params.type} interview for a ${params.jobTitle} position${params.company ? ` at ${params.company}` : ""}.

${typeInstructions[params.type]}

RULES:
- Ask one question at a time
- Wait for the candidate's response before proceeding
- Provide brief, constructive feedback after each answer
- Rate each answer on a scale of 1-10
- Be encouraging but honest
- After 5-7 questions, wrap up the interview
- Keep questions relevant to the specific role

Start by introducing yourself and asking the first question.`;
}

export function buildInterviewFeedbackPrompt(messages: Array<{ role: string; content: string }>): string {
  const conversation = messages.map(m => `${m.role === "assistant" ? "INTERVIEWER" : "CANDIDATE"}: ${m.content}`).join("\n\n");

  return `Analyze this interview and provide comprehensive feedback.

INTERVIEW TRANSCRIPT:
${conversation}

Provide feedback as JSON:
{
  "overallScore": <0-100>,
  "strengths": ["string"],
  "areasToImprove": ["string"],
  "questionBreakdown": [
    { "question": "string", "score": <1-10>, "feedback": "string" }
  ],
  "tips": ["string"],
  "overallFeedback": "2-3 sentence summary"
}

Return ONLY valid JSON.`;
}
