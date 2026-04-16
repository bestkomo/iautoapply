/**
 * AI Resume Tailoring Service
 *
 * Generates a job-specific resume by rewriting the user's profile data
 * to emphasize keywords and experience relevant to the target job.
 * Outputs a PDF that gets uploaded with the application.
 */

import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";
import { getProviderForFeature } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";
import { fromJsonArray } from "@/lib/db/json-array";
import { uploadResumeToVPS } from "./vps-client";

export interface TailoredResumeData {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  summary: string;
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    endDate?: string;
  }>;
  skills: string[];
  certifications?: string[];
}

/**
 * Generates a tailored resume for a specific job by asking Claude to
 * rewrite the user's profile to emphasize relevant skills/experience.
 */
export async function generateTailoredResumeContent(
  userId: string,
  jobTitle: string,
  jobDescription: string,
  company: string
): Promise<TailoredResumeData | null> {
  try {
    // Fetch the user's profile data
    const user = await prisma.user.findFirst({
      where: { id: userId },
      include: {
        profile: {
          include: {
            experiences: { orderBy: { sortOrder: "asc" } },
            education: true,
            skills: true,
            certifications: true,
          },
        },
      },
    });

    if (!user || !user.profile) {
      console.error(`[Tailored] No profile for user ${userId}`);
      return null;
    }

    const profile = user.profile;

    // Build the source resume data
    const sourceData = {
      name: user.name || "Applicant",
      email: profile.email || user.email,
      phone: profile.phone,
      location: profile.location,
      linkedin: profile.linkedinUrl,
      summary: profile.summary || "",
      experiences: profile.experiences.map((e) => ({
        title: e.title,
        company: e.company,
        location: e.location,
        startDate: e.startDate.toISOString().substring(0, 7),
        endDate: e.endDate ? e.endDate.toISOString().substring(0, 7) : null,
        current: e.current,
        description: e.description || "",
        bullets: fromJsonArray(e.bullets as unknown as string),
      })),
      education: profile.education.map((e) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startDate: e.startDate.toISOString().substring(0, 7),
        endDate: e.endDate ? e.endDate.toISOString().substring(0, 7) : null,
      })),
      skills: profile.skills.map((s) => s.name),
      certifications: profile.certifications.map((c) => `${c.name} (${c.issuer})`),
    };

    // Ask Claude to tailor the resume
    const ai = getProviderForFeature("resume");
    const prompt = `You are an expert resume writer. Tailor this candidate's resume for the specific job below by:
1. Rewriting the professional summary to align with the job requirements
2. Reordering experience bullets to put the most relevant ones first
3. Rewriting bullets to use keywords from the job description (without lying)
4. Filtering skills to highlight ones most relevant to this job
5. Keeping all factual information truthful — only rephrase, don't invent

JOB TITLE: ${jobTitle}
COMPANY: ${company}
JOB DESCRIPTION:
${jobDescription.substring(0, 4000)}

CANDIDATE'S CURRENT RESUME:
${JSON.stringify(sourceData, null, 2)}

Return a JSON object with this exact structure (no markdown, just JSON):
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedinUrl": "string",
  "summary": "string (2-3 sentences tailored to this job)",
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null if current",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "endDate": "YYYY-MM or null"
    }
  ],
  "skills": ["skill 1", "skill 2"],
  "certifications": ["cert 1"]
}`;

    const response = await ai.generateText(prompt, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    let jsonStr = response.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    const tailored = JSON.parse(jsonStr.substring(start, end + 1)) as TailoredResumeData;
    return tailored;
  } catch (err) {
    console.error("[Tailored] Generation error:", err);
    return null;
  }
}

/**
 * Renders a TailoredResumeData object to a PDF file on disk.
 */
export async function renderResumePDF(
  data: TailoredResumeData,
  outputPath: string
): Promise<string> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
    });

    // Cast to Node WriteStream type
    import("fs").then(({ createWriteStream }) => {
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);

      // === HEADER ===
      doc.fontSize(20).font("Helvetica-Bold").text(data.fullName.toUpperCase(), { align: "center" });
      doc.moveDown(0.3);

      // Contact line
      const contactParts = [data.email, data.phone, data.location].filter(Boolean);
      doc.fontSize(10).font("Helvetica").text(contactParts.join(" • "), { align: "center" });
      if (data.linkedinUrl) {
        doc.fontSize(9).fillColor("#0066cc").text(data.linkedinUrl, { align: "center", link: data.linkedinUrl });
        doc.fillColor("black");
      }
      doc.moveDown(0.8);

      // Horizontal line
      doc.moveTo(60, doc.y).lineTo(552, doc.y).strokeColor("#888").stroke();
      doc.moveDown(0.5);

      // === SUMMARY ===
      if (data.summary) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333").text("PROFESSIONAL SUMMARY");
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica").fillColor("black").text(data.summary, { align: "justify" });
        doc.moveDown(0.6);
      }

      // === EXPERIENCE ===
      if (data.experience && data.experience.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333").text("PROFESSIONAL EXPERIENCE");
        doc.moveDown(0.3);

        for (const exp of data.experience) {
          doc.fontSize(10.5).font("Helvetica-Bold").fillColor("black").text(exp.title);
          const companyLine = `${exp.company}${exp.location ? ` • ${exp.location}` : ""}`;
          const dateLine = `${exp.startDate} - ${exp.endDate || "Present"}`;

          doc.fontSize(10).font("Helvetica-Oblique").text(companyLine, { continued: true })
            .font("Helvetica").text(`     ${dateLine}`, { align: "right" });
          doc.moveDown(0.2);

          for (const bullet of exp.bullets || []) {
            doc.fontSize(9.5).font("Helvetica").fillColor("black").text(`•  ${bullet}`, { indent: 12 });
            doc.moveDown(0.1);
          }
          doc.moveDown(0.4);
        }
      }

      // === EDUCATION ===
      if (data.education && data.education.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333").text("EDUCATION");
        doc.moveDown(0.3);

        for (const edu of data.education) {
          doc.fontSize(10.5).font("Helvetica-Bold").fillColor("black").text(edu.institution);
          const degreeLine = `${edu.degree}${edu.field ? ` in ${edu.field}` : ""}`;
          doc.fontSize(10).font("Helvetica-Oblique").text(degreeLine, { continued: true });
          if (edu.endDate) {
            doc.font("Helvetica").text(`     ${edu.endDate}`, { align: "right" });
          } else {
            doc.text("");
          }
          doc.moveDown(0.4);
        }
      }

      // === SKILLS ===
      if (data.skills && data.skills.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333").text("SKILLS");
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica").fillColor("black").text(data.skills.join(" • "));
        doc.moveDown(0.5);
      }

      // === CERTIFICATIONS ===
      if (data.certifications && data.certifications.length > 0) {
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#333").text("CERTIFICATIONS");
        doc.moveDown(0.3);
        for (const cert of data.certifications) {
          doc.fontSize(10).font("Helvetica").fillColor("black").text(`•  ${cert}`, { indent: 12 });
        }
      }

      doc.end();
      stream.on("finish", () => resolve(outputPath));
      stream.on("error", reject);
    }).catch(reject);
  });
}

/**
 * Full workflow: tailor the resume for a job, render to PDF,
 * upload it to the VPS, return the VPS-side path for use in the application.
 */
export async function generateAndUploadTailoredResume(
  userId: string,
  jobId: string,
  jobTitle: string,
  jobDescription: string,
  company: string
): Promise<string | null> {
  try {
    console.log(`[Tailored] Generating tailored resume for job ${jobId} (${jobTitle})`);

    const tailored = await generateTailoredResumeContent(
      userId,
      jobTitle,
      jobDescription,
      company
    );

    if (!tailored) {
      console.warn(`[Tailored] Could not generate tailored content for ${userId}`);
      return null;
    }

    // Render to local PDF
    const localPath = path.join(
      process.cwd(),
      "tmp-resumes",
      `${userId}-${jobId}-${Date.now()}.pdf`
    );
    await renderResumePDF(tailored, localPath);
    console.log(`[Tailored] Rendered PDF: ${localPath}`);

    // Upload to VPS so Playwright can attach it
    const buffer = await fs.readFile(localPath);
    const filename = `${jobId}-tailored.pdf`;
    const uploadResult = await uploadResumeToVPS(`${userId}-${jobId}`, filename, buffer);

    if (!uploadResult.success || !uploadResult.path) {
      console.warn(`[Tailored] Upload to VPS failed`);
      return null;
    }

    // Clean up the local temp file
    await fs.unlink(localPath).catch(() => {});

    console.log(`[Tailored] Uploaded to VPS: ${uploadResult.path}`);
    return uploadResult.path;
  } catch (err) {
    console.error("[Tailored] Full workflow error:", err);
    return null;
  }
}
