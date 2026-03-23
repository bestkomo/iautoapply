import { z } from "zod";

export const personalInfoSchema = z.object({
  headline: z.string().max(120).optional(),
  summary: z.string().max(2000).optional(),
  phone: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url().optional().or(z.literal("")),
});

export const experienceSchema = z.object({
  title: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  location: z.string().max(100).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  description: z.string().max(2000).optional(),
  bullets: z.array(z.string()).default([]),
});

export const educationSchema = z.object({
  institution: z.string().min(1).max(100),
  degree: z.string().min(1).max(100),
  field: z.string().max(100).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  gpa: z.number().min(0).max(4).optional(),
  description: z.string().max(1000).optional(),
});

export const skillSchema = z.object({
  name: z.string().min(1).max(50),
  level: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"])
    .default("INTERMEDIATE"),
  category: z.string().max(50).optional(),
});

export const preferencesSchema = z.object({
  desiredTitles: z.array(z.string()).default([]),
  desiredLocations: z.array(z.string()).default([]),
  remoteOnly: z.boolean().default(false),
  salaryMin: z.number().optional(),
  jobTypes: z
    .array(
      z.enum([
        "FULL_TIME",
        "PART_TIME",
        "CONTRACT",
        "FREELANCE",
        "INTERNSHIP",
      ])
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  excludeCompanies: z.array(z.string()).default([]),
});

export type PersonalInfoData = z.infer<typeof personalInfoSchema>;
export type ExperienceData = z.infer<typeof experienceSchema>;
export type EducationData = z.infer<typeof educationSchema>;
export type SkillData = z.infer<typeof skillSchema>;
export type PreferencesData = z.infer<typeof preferencesSchema>;
