export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import { getProviderForFeature } from "@/lib/ai/provider";
import { toJsonArray } from "@/lib/db/json-array";
import { saveResumeFile } from "@/lib/automation/resume-file";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("resume") as File;
  if (!file)
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  // Read file content as text
  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";

  if (file.name.endsWith(".pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer));
      text = Array.isArray(result.text) ? result.text.join("\n") : (result.text || "");
      console.log("[Upload] PDF text extracted, length:", text.length, "preview:", text.substring(0, 200));
    } catch (pdfErr) {
      console.error("[Upload] PDF parse error:", pdfErr);
      text = "";
    }
  } else if (file.name.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch {
      text = buffer.toString("utf-8");
    }
  } else if (file.name.endsWith(".txt")) {
    text = buffer.toString("utf-8");
  } else {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, DOCX, or TXT." },
      { status: 400 }
    );
  }

  if (!text || text.trim().length < 50) {
    return NextResponse.json(
      {
        error:
          "Could not extract enough text from the file. Try a different format.",
      },
      { status: 400 }
    );
  }

  // Use AI to parse the resume into structured data
  const ai = getProviderForFeature("resume");
  const parsePrompt = `Parse this resume text and extract ALL information into structured JSON. Be thorough - extract every detail.

RESUME TEXT:
${text.substring(0, 8000)}

Return valid JSON matching this exact structure:
{
  "name": "full name",
  "email": "email if found",
  "phone": "phone if found",
  "location": "city, state/country if found",
  "headline": "professional title/headline",
  "summary": "professional summary or objective",
  "linkedin": "linkedin url if found",
  "portfolio": "portfolio/website url if found",
  "github": "github url if found",
  "experiences": [
    {
      "title": "job title",
      "company": "company name",
      "location": "city, state",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null if current",
      "current": true/false,
      "description": "role description",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "school name",
      "degree": "degree type (BS, MS, etc.)",
      "field": "field of study",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or null",
      "gpa": number or null
    }
  ],
  "skills": [
    { "name": "skill name", "category": "technical|soft|tools|language" }
  ],
  "certifications": [
    { "name": "cert name", "issuer": "issuing org", "date": "YYYY-MM or null" }
  ],
  "languages": [
    { "language": "language name", "proficiency": "native|fluent|intermediate|basic" }
  ],
  "desiredTitles": ["job titles this person would likely search for based on their experience"],
  "desiredJobTypes": ["FULL_TIME", "CONTRACT", etc based on their profile]
}

IMPORTANT: Extract EVERYTHING. For skills, be comprehensive - include programming languages, frameworks, tools, methodologies, soft skills. For desiredTitles, infer 3-5 job titles they'd search for. Return ONLY valid JSON.`;

  console.log("[Upload] Sending to AI, text length:", text.substring(0, 8000).length);
  let response;
  try {
    response = await ai.generateText(parsePrompt, {
      maxTokens: 4096,
      temperature: 0.3,
    });
    console.log("[Upload] AI response length:", response.text.length, "preview:", response.text.substring(0, 200));
  } catch (aiErr) {
    console.error("[Upload] AI error:", aiErr);
    return NextResponse.json(
      { error: "AI processing failed. Check your API key." },
      { status: 500 }
    );
  }

  let parsed;
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    parsed = JSON.parse(jsonStr.trim());
    console.log("[Upload] Parsed result:", JSON.stringify({ name: parsed.name, skills: parsed.skills?.length, experiences: parsed.experiences?.length }));
  } catch (parseErr) {
    console.error("[Upload] JSON parse error:", parseErr, "Raw:", response.text.substring(0, 500));
    return NextResponse.json(
      { error: "Failed to parse resume. Please try again." },
      { status: 500 }
    );
  }

  // Save parsed data to user profile
  const userId = session.user.id;

  // Upsert profile
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {
      email: parsed.email || undefined,
      headline: parsed.headline || undefined,
      summary: parsed.summary || undefined,
      phone: parsed.phone || undefined,
      location: parsed.location || undefined,
      linkedinUrl: parsed.linkedin || undefined,
      portfolioUrl: parsed.portfolio || undefined,
      githubUrl: parsed.github || undefined,
    },
    create: {
      userId,
      email: parsed.email,
      headline: parsed.headline,
      summary: parsed.summary,
      phone: parsed.phone,
      location: parsed.location,
      linkedinUrl: parsed.linkedin,
      portfolioUrl: parsed.portfolio,
      githubUrl: parsed.github,
    },
  });

  // Update user name if parsed
  if (parsed.name) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.name },
    });
  }

  // Clear and re-add experiences
  await prisma.experience.deleteMany({ where: { profileId: profile.id } });
  if (parsed.experiences?.length) {
    for (let i = 0; i < parsed.experiences.length; i++) {
      const exp = parsed.experiences[i];
      await prisma.experience.create({
        data: {
          profileId: profile.id,
          title: exp.title || "Unknown",
          company: exp.company || "Unknown",
          location: exp.location,
          startDate: new Date(exp.startDate || "2020-01"),
          endDate: exp.endDate ? new Date(exp.endDate) : null,
          current: exp.current || false,
          description: exp.description,
          bullets: toJsonArray(exp.bullets),
          sortOrder: i,
        },
      });
    }
  }

  // Clear and re-add education
  await prisma.education.deleteMany({ where: { profileId: profile.id } });
  if (parsed.education?.length) {
    for (const edu of parsed.education) {
      await prisma.education.create({
        data: {
          profileId: profile.id,
          institution: edu.institution || "Unknown",
          degree: edu.degree || "Unknown",
          field: edu.field,
          startDate: new Date(edu.startDate || "2015-01"),
          endDate: edu.endDate ? new Date(edu.endDate) : null,
          gpa: edu.gpa ? parseFloat(edu.gpa) : null,
        },
      });
    }
  }

  // Clear and re-add skills
  await prisma.skill.deleteMany({ where: { profileId: profile.id } });
  if (parsed.skills?.length) {
    await prisma.skill.createMany({
      data: parsed.skills.map(
        (s: { name: string; category?: string }) => ({
          profileId: profile.id,
          name: s.name,
          level: "INTERMEDIATE" as const,
          category: s.category,
        })
      ),
    });
  }

  // Clear and re-add certifications
  await prisma.certification.deleteMany({
    where: { profileId: profile.id },
  });
  if (parsed.certifications?.length) {
    for (const cert of parsed.certifications) {
      await prisma.certification.create({
        data: {
          profileId: profile.id,
          name: cert.name,
          issuer: cert.issuer || "",
          issueDate: cert.date ? new Date(cert.date) : null,
        },
      });
    }
  }

  // Clear and re-add languages
  await prisma.userLanguage.deleteMany({
    where: { profileId: profile.id },
  });
  if (parsed.languages?.length) {
    await prisma.userLanguage.createMany({
      data: parsed.languages.map(
        (l: { language: string; proficiency: string }) => ({
          profileId: profile.id,
          language: l.language,
          proficiency: l.proficiency,
        })
      ),
    });
  }

  // Update job preferences with inferred data
  const desiredTitles = parsed.desiredTitles || [];
  const jobTypes = (parsed.desiredJobTypes || ["FULL_TIME"]).filter(
    (t: string) =>
      ["FULL_TIME", "PART_TIME", "CONTRACT", "FREELANCE", "INTERNSHIP"].includes(t)
  );
  const skillNames = (parsed.skills || []).map(
    (s: { name: string }) => s.name
  );

  await prisma.jobPreference.upsert({
    where: { userId },
    update: {
      desiredTitles: toJsonArray(desiredTitles),
      skills: toJsonArray(skillNames),
      jobTypes: toJsonArray(jobTypes),
      desiredLocations: toJsonArray(parsed.location ? [parsed.location] : []),
    },
    create: {
      userId,
      desiredTitles: toJsonArray(desiredTitles),
      skills: toJsonArray(skillNames),
      jobTypes: toJsonArray(jobTypes),
      desiredLocations: toJsonArray(parsed.location ? [parsed.location] : []),
    },
  });

  // Save the resume file to disk so Playwright can upload it when auto-applying
  try {
    await saveResumeFile(userId, buffer, file.name);
    console.log("[Upload] Resume file saved to disk for Playwright automation");
  } catch (saveErr) {
    console.error("[Upload] Failed to save resume file to disk:", saveErr);
    // Non-critical: don't fail the whole upload if file save fails
  }

  return NextResponse.json({
    success: true,
    parsed: {
      name: parsed.name,
      headline: parsed.headline,
      experienceCount: parsed.experiences?.length || 0,
      educationCount: parsed.education?.length || 0,
      skillCount: parsed.skills?.length || 0,
      desiredTitles: desiredTitles,
    },
  });
}
