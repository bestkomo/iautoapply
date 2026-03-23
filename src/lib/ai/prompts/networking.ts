export type NetworkingMessageType =
  | "linkedin_connect"
  | "follow_up"
  | "cold_email"
  | "thank_you"
  | "salary_negotiation";

export function buildNetworkingPrompt(params: {
  type: NetworkingMessageType;
  senderName: string;
  senderTitle: string;
  recipientName?: string;
  recipientTitle?: string;
  company?: string;
  context?: string;
}): string {
  const instructions: Record<NetworkingMessageType, string> = {
    linkedin_connect: `Write a LinkedIn connection request message (MAX 300 characters). Be personal, mention something specific, and explain why you want to connect.`,
    follow_up: `Write a follow-up message after connecting on LinkedIn or meeting at an event. Reference the connection point and suggest a next step.`,
    cold_email: `Write a cold outreach email to a recruiter or hiring manager. Be concise, show value, and include a clear ask.`,
    thank_you: `Write a thank-you note after an interview. Reference specific topics discussed and reaffirm interest.`,
    salary_negotiation: `Write a professional salary negotiation email. Be confident but respectful. Reference market data and your value.`,
  };

  return `${instructions[params.type]}

FROM: ${params.senderName} (${params.senderTitle})
${params.recipientName ? `TO: ${params.recipientName}${params.recipientTitle ? ` (${params.recipientTitle})` : ""}` : ""}
${params.company ? `COMPANY: ${params.company}` : ""}
${params.context ? `CONTEXT: ${params.context}` : ""}

RULES:
- Sound natural and human, not robotic
- Be specific, not generic
- Keep it concise
- Include a clear next step or call to action
- Return ONLY the message text`;
}
