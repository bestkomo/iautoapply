export function buildCoverLetterPrompt(params: {
  candidateName: string;
  candidateSummary: string;
  relevantExperience: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  tone?: "professional" | "enthusiastic" | "concise";
}): string {
  return `Write a cover letter for the following job application.

CANDIDATE: ${params.candidateName}
BACKGROUND: ${params.candidateSummary}
KEY EXPERIENCE: ${params.relevantExperience}

JOB: ${params.jobTitle} at ${params.company}
DESCRIPTION: ${params.jobDescription}

TONE: ${params.tone || "professional"}

RULES:
- 3-4 paragraphs
- Opening: Hook + why this specific role at this specific company
- Body: Map 2-3 key experiences/skills directly to job requirements
- Closing: Express enthusiasm + call to action
- Do NOT use generic phrases like "I am writing to express my interest"
- Be specific about the company and role
- Show personality while remaining professional
- Keep under 400 words
- Return ONLY the cover letter text, no subject line or formatting instructions`;
}
