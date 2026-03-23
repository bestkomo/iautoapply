export function buildTranslatePrompt(resumeContent: string, targetLanguage: string): string {
  return `Translate the following resume content to ${targetLanguage}.

IMPORTANT RULES:
- Preserve all formatting and structure exactly
- Keep proper nouns (company names, university names, certification names) in their original form unless they have an official translation
- Use professional/formal register appropriate for resumes in the target language
- Translate job titles to their standard equivalent in the target language's job market
- Keep technical terms that are commonly used in English (e.g., "JavaScript", "Agile") unless there is a standard translation
- Maintain all dates, numbers, and measurements in their original format

CONTENT TO TRANSLATE:
${resumeContent}

Return ONLY the translated content, maintaining the exact same structure.`;
}
