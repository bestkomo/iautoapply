export function buildResumePrompt(profile: {
  name: string;
  headline?: string;
  summary?: string;
  experiences: Array<{ title: string; company: string; location?: string; startDate: string; endDate?: string; current: boolean; description?: string; bullets: string[] }>;
  education: Array<{ institution: string; degree: string; field?: string; startDate: string; endDate?: string; gpa?: string }>;
  skills: Array<{ name: string; level: string; category?: string }>;
  certifications: Array<{ name: string; issuer: string; issueDate?: string }>;
}, jobDescription?: string): string {
  let prompt = `Generate an ATS-optimized resume in JSON format for the following candidate.

CANDIDATE PROFILE:
Name: ${profile.name}
${profile.headline ? `Headline: ${profile.headline}` : ""}
${profile.summary ? `Summary: ${profile.summary}` : ""}

WORK EXPERIENCE:
${profile.experiences.map(exp => `- ${exp.title} at ${exp.company}${exp.location ? ` (${exp.location})` : ""}, ${exp.startDate} - ${exp.current ? "Present" : exp.endDate || "N/A"}
  ${exp.bullets.length > 0 ? exp.bullets.map(b => `  * ${b}`).join("\n") : exp.description || ""}`).join("\n")}

EDUCATION:
${profile.education.map(edu => `- ${edu.degree}${edu.field ? ` in ${edu.field}` : ""} from ${edu.institution}, ${edu.startDate} - ${edu.endDate || "N/A"}${edu.gpa ? ` (GPA: ${edu.gpa})` : ""}`).join("\n")}

SKILLS:
${profile.skills.map(s => `- ${s.name} (${s.level})${s.category ? ` [${s.category}]` : ""}`).join("\n")}

${profile.certifications.length > 0 ? `CERTIFICATIONS:\n${profile.certifications.map(c => `- ${c.name} by ${c.issuer}${c.issueDate ? ` (${c.issueDate})` : ""}`).join("\n")}` : ""}`;

  if (jobDescription) {
    prompt += `\n\nTARGET JOB DESCRIPTION:\n${jobDescription}\n\nTailor the resume to match this job description. Emphasize relevant skills and experience. Use keywords from the job posting naturally in bullet points.`;
  }

  prompt += `\n\nOUTPUT FORMAT: Return valid JSON matching this structure:
{
  "personalInfo": { "name": "string", "headline": "string" },
  "summary": "2-3 sentence professional summary",
  "experience": [{ "title": "string", "company": "string", "location": "string", "dates": "string", "bullets": ["achievement-focused bullet points with metrics"] }],
  "education": [{ "degree": "string", "institution": "string", "dates": "string", "gpa": "string or null" }],
  "skills": { "technical": ["string"], "soft": ["string"], "tools": ["string"] },
  "certifications": [{ "name": "string", "issuer": "string", "date": "string" }]
}

RULES:
- Use strong action verbs (Led, Developed, Implemented, Optimized)
- Include quantified achievements where possible (%, $, numbers)
- Keep bullet points concise (1-2 lines each)
- 3-5 bullets per experience
- Optimize for ATS keyword scanning
- Return ONLY valid JSON, no markdown or explanation`;

  return prompt;
}
