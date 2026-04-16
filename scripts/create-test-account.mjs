/**
 * Creates a ready-to-use test account with a pre-filled profile,
 * application answers, and a resume. Email: test@iautoaply.com
 * Password: Test1234!
 */
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const { Client } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_EqtTCd2m8xzL@ep-soft-sea-ani0ci91-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

const EMAIL = "test@iautoaply.com";
const PASSWORD = "Test1234!";
const NAME = "Test User";

function cuid() {
  return "c" + randomBytes(12).toString("hex");
}

const c = new Client({ connectionString: DATABASE_URL });
await c.connect();
console.log("Connected to Neon");

// Delete existing test account (and cascade everything)
await c.query('DELETE FROM "User" WHERE email = $1', [EMAIL]);
console.log("Cleaned up any existing test account");

// Create user
const userId = cuid();
const passwordHash = await bcrypt.hash(PASSWORD, 10);

await c.query(
  `INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
   VALUES ($1, $2, $3, $4, NOW(), NOW())`,
  [userId, EMAIL, NAME, passwordHash]
);
console.log("Created user:", userId);

// Create profile
const profileId = cuid();
await c.query(
  `INSERT INTO "UserProfile" (id, "userId", email, headline, summary, phone, location, "linkedinUrl")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [
    profileId,
    userId,
    EMAIL,
    "Healthcare Benefits & Insurance Verification Specialist",
    "Results-driven Healthcare Benefits and Insurance Verification Specialist with 8+ years of experience in patient access, insurance eligibility verification, prior authorization, and claims processing.",
    "(555) 123-4567",
    "Houston, TX 77084",
    "https://linkedin.com/in/testuser",
  ]
);
console.log("Created profile");

// Add experiences
const experiences = [
  {
    title: "Senior Insurance Verification Specialist",
    company: "Houston Medical Center",
    location: "Houston, TX",
    startDate: new Date("2020-01-01"),
    endDate: null,
    current: true,
    description: "Lead insurance verification for 200+ patients daily",
    bullets: [
      "Verified insurance eligibility and benefits for complex patient cases using Epic EHR",
      "Processed 50+ prior authorizations daily with 98% approval rate",
      "Trained 10+ new team members on insurance verification workflows",
    ],
  },
  {
    title: "Patient Access Specialist",
    company: "Texas Health Resources",
    location: "Dallas, TX",
    startDate: new Date("2017-06-01"),
    endDate: new Date("2019-12-31"),
    current: false,
    description: "Managed patient registration and insurance verification",
    bullets: [
      "Processed patient registrations for 100+ patients daily",
      "Verified insurance benefits using payer portals (Availity, Navinet)",
      "Reduced claim denials by 30% through accurate pre-registration",
    ],
  },
];

for (let i = 0; i < experiences.length; i++) {
  const e = experiences[i];
  await c.query(
    `INSERT INTO "Experience" (id, "profileId", title, company, location, "startDate", "endDate", current, description, bullets, "sortOrder")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [cuid(), profileId, e.title, e.company, e.location, e.startDate, e.endDate, e.current, e.description, JSON.stringify(e.bullets), i]
  );
}
console.log("Created 2 experiences");

// Add education
await c.query(
  `INSERT INTO "Education" (id, "profileId", institution, degree, field, "startDate", "endDate")
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [cuid(), profileId, "University of Houston", "Bachelor's", "Healthcare Administration", new Date("2013-08-01"), new Date("2017-05-31")]
);
console.log("Created education");

// Add skills
const skills = [
  "Insurance Eligibility & Benefits Verification",
  "Prior Authorization",
  "Epic EHR",
  "Payer Portal Navigation",
  "Claims Review & Denial Resolution",
  "Patient Access & Registration",
  "Medical Billing",
  "HIPAA Compliance",
  "Healthcare Customer Service",
  "Availity",
  "Navinet",
  "Microsoft Office",
];

for (const s of skills) {
  await c.query(
    `INSERT INTO "Skill" (id, "profileId", name, level, category)
     VALUES ($1, $2, $3, $4, $5)`,
    [cuid(), profileId, s, "EXPERT", "technical"]
  );
}
console.log(`Created ${skills.length} skills`);

// Add JobPreference
await c.query(
  `INSERT INTO "JobPreference" (id, "userId", "desiredTitles", "desiredLocations", "remoteOnly", "jobTypes", skills, "excludeCompanies", "autoApplyEnabled", "maxAutoApplyDay")
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [
    cuid(),
    userId,
    JSON.stringify([
      "Insurance Verification Specialist",
      "Patient Access Specialist",
      "Healthcare Benefits Specialist",
      "Medical Billing Specialist",
      "Customer Service Representative",
    ]),
    JSON.stringify(["Houston, TX", "Remote"]),
    false,
    JSON.stringify(["FULL_TIME", "PART_TIME", "CONTRACT"]),
    JSON.stringify(skills),
    JSON.stringify([]),
    false,
    10,
  ]
);
console.log("Created job preferences");

// Add ApplicationAnswers with all the fields pre-filled
await c.query(
  `INSERT INTO "ApplicationAnswers" (
    id, "userId",
    "authorizedToWork", "requireSponsorship",
    "isOver18", "hasDriversLicense", "hasFelonyConviction",
    "willingToRelocate", "willingToTravel",
    "desiredSalary", "availableStartDate", "howDidYouHear",
    "yearsOfExperience", "highestEducation",
    gender, race, "veteranStatus", "disabilityStatus",
    "linkedinUrl", "portfolioUrl", "preferredName",
    "streetAddress", city, state, "zipCode", country,
    "visaStatus",
    "hasBackgroundCheck", "hasDrugTest", "hasMisdemeanor",
    "currentSalary", "salaryExpectation", "noticeRequired",
    "preferredWorkType", "willingShifts", "willingOvertime", "willingWeekends", "remotePreference",
    pronouns, "hispanicLatino", "ageRange",
    "hasNursingLicense", "hasCPR", "hasBLS", "hasMedicalExperience",
    "hasReferences", "updatedAt"
  ) VALUES (
    $1, $2,
    true, false,
    true, true, false,
    true, true,
    65000, 'Immediately', 'LinkedIn',
    8, 'Bachelor''s',
    'Decline to answer', 'Decline to answer', 'Not a Veteran', 'No',
    'https://linkedin.com/in/testuser', '', 'Test',
    '123 Main St', 'Houston', 'TX', '77084', 'United States',
    'US Citizen',
    true, true, false,
    55000, '$60,000-$75,000', '2 weeks',
    'Full-time', 'Day', true, true, 'Hybrid',
    'Decline to answer', 'No', '25-34',
    false, true, true, 8,
    true, NOW()
  )`,
  [cuid(), userId]
);
console.log("Created application answers");

// Check the resume directory on Render - we'll let the user upload their own
// or if none exists we'll just let the upload flow handle it

console.log("\n==========================================");
console.log("✅ TEST ACCOUNT READY");
console.log("==========================================");
console.log(`Email:    ${EMAIL}`);
console.log(`Password: ${PASSWORD}`);
console.log(`Name:     ${NAME}`);
console.log(`Profile:  8+ years healthcare experience`);
console.log(`Location: Houston, TX 77084`);
console.log(`Skills:   ${skills.length} (Epic EHR, Insurance Verification, etc.)`);
console.log(`Auto-Apply: Ready (disabled - toggle on after login)`);
console.log("");
console.log("NOTE: You still need to upload a resume PDF after login");
console.log("      OR we can copy an existing user's resume. Tell me which.");
console.log("==========================================");

await c.end();
