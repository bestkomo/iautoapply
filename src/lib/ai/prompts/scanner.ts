export function buildScannerPrompt(resumeText: string, jobDescription?: string): string {
  let prompt = `Analyze this resume for ATS optimization and quality. Provide a detailed assessment.

RESUME TEXT:
${resumeText}`;

  if (jobDescription) {
    prompt += `\n\nTARGET JOB DESCRIPTION:\n${jobDescription}`;
  }

  prompt += `\n\nProvide your analysis as JSON:
{
  "overallScore": <0-100>,
  "sections": {
    "format": { "score": <0-100>, "issues": ["string"], "suggestions": ["string"] },
    "content": { "score": <0-100>, "issues": ["string"], "suggestions": ["string"] },
    "keywords": { "score": <0-100>, "matched": ["string"], "missing": ["string"], "suggestions": ["string"] },
    "impact": { "score": <0-100>, "weakBullets": ["string"], "improvedVersions": ["string"], "suggestions": ["string"] }
  },
  "topImprovements": ["top 3 most impactful changes to make"],
  "strengths": ["top 3 strengths of this resume"]
}

Be specific and actionable in suggestions. Return ONLY valid JSON.`;

  return prompt;
}
