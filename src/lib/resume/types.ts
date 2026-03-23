export interface ResumeContent {
  personalInfo: {
    name: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    portfolio?: string;
  };
  summary?: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    dates: string;
    bullets: string[];
  }>;
  education: Array<{
    degree: string;
    institution: string;
    dates: string;
    gpa?: string | null;
  }>;
  skills: {
    technical: string[];
    soft: string[];
    tools: string[];
  };
  certifications?: Array<{
    name: string;
    issuer: string;
    date?: string;
  }>;
}

export interface TemplateProps {
  content: ResumeContent;
}
