"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Save,
  Loader2,
  ShieldCheck,
  User,
  Briefcase,
  Heart,
  Link2,
  MapPin,
  Globe,
  Search,
  DollarSign,
  Clock,
  Stethoscope,
  Users,
} from "lucide-react";

interface FormValues {
  authorizedToWork: boolean;
  requireSponsorship: boolean;
  isOver18: boolean;
  hasDriversLicense: boolean;
  hasFelonyConviction: boolean;
  willingToRelocate: boolean;
  willingToTravel: boolean;
  desiredSalary: number | null;
  availableStartDate: string;
  howDidYouHear: string;
  yearsOfExperience: number;
  highestEducation: string;
  gender: string;
  race: string;
  veteranStatus: string;
  disabilityStatus: string;
  linkedinUrl: string;
  portfolioUrl: string;
  preferredName: string;
  // Address
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  // Visa
  visaStatus: string;
  // Background
  hasBackgroundCheck: boolean;
  hasDrugTest: boolean;
  hasMisdemeanor: boolean;
  // Compensation
  currentSalary: number | null;
  salaryExpectation: string;
  noticeRequired: string;
  // Work prefs
  preferredWorkType: string;
  willingShifts: string;
  willingOvertime: boolean;
  willingWeekends: boolean;
  remotePreference: string;
  // Demographics ext
  pronouns: string;
  hispanicLatino: string;
  ageRange: string;
  // Healthcare
  hasNursingLicense: boolean;
  nursingLicenseState: string;
  hasCPR: boolean;
  hasBLS: boolean;
  hasMedicalExperience: number | null;
  // References
  hasReferences: boolean;
  referenceName1: string;
  referenceEmail1: string;
  referencePhone1: string;
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function QuestionnairePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, watch, setValue, reset } =
    useForm<FormValues>({
      defaultValues: {
        authorizedToWork: true,
        requireSponsorship: false,
        isOver18: true,
        hasDriversLicense: false,
        hasFelonyConviction: false,
        willingToRelocate: true,
        willingToTravel: true,
        desiredSalary: null,
        availableStartDate: "Immediately",
        howDidYouHear: "Job Board",
        yearsOfExperience: 0,
        highestEducation: "Bachelor's",
        gender: "Decline to answer",
        race: "Decline to answer",
        veteranStatus: "Decline to answer",
        disabilityStatus: "Decline to answer",
        linkedinUrl: "",
        portfolioUrl: "",
        preferredName: "",
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
        country: "United States",
        visaStatus: "US Citizen",
        hasBackgroundCheck: true,
        hasDrugTest: true,
        hasMisdemeanor: false,
        currentSalary: null,
        salaryExpectation: "Negotiable",
        noticeRequired: "2 weeks",
        preferredWorkType: "Full-time",
        willingShifts: "Day",
        willingOvertime: true,
        willingWeekends: true,
        remotePreference: "Hybrid",
        pronouns: "",
        hispanicLatino: "Decline to answer",
        ageRange: "Decline to answer",
        hasNursingLicense: false,
        nursingLicenseState: "",
        hasCPR: false,
        hasBLS: false,
        hasMedicalExperience: null,
        hasReferences: true,
        referenceName1: "",
        referenceEmail1: "",
        referencePhone1: "",
      },
    });

  const values = watch();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/application-answers");
        if (res.ok) {
          const data = await res.json();
          reset({
            authorizedToWork: data.authorizedToWork ?? true,
            requireSponsorship: data.requireSponsorship ?? false,
            isOver18: data.isOver18 ?? true,
            hasDriversLicense: data.hasDriversLicense ?? false,
            hasFelonyConviction: data.hasFelonyConviction ?? false,
            willingToRelocate: data.willingToRelocate ?? true,
            willingToTravel: data.willingToTravel ?? true,
            desiredSalary: data.desiredSalary ?? null,
            availableStartDate: data.availableStartDate || "Immediately",
            howDidYouHear: data.howDidYouHear || "Job Board",
            yearsOfExperience: data.yearsOfExperience ?? 0,
            highestEducation: data.highestEducation || "Bachelor's",
            gender: data.gender || "Decline to answer",
            race: data.race || "Decline to answer",
            veteranStatus: data.veteranStatus || "Decline to answer",
            disabilityStatus: data.disabilityStatus || "Decline to answer",
            linkedinUrl: data.linkedinUrl || "",
            portfolioUrl: data.portfolioUrl || "",
            preferredName: data.preferredName || "",
            streetAddress: data.streetAddress || "",
            city: data.city || "",
            state: data.state || "",
            zipCode: data.zipCode || "",
            country: data.country || "United States",
            visaStatus: data.visaStatus || "US Citizen",
            hasBackgroundCheck: data.hasBackgroundCheck ?? true,
            hasDrugTest: data.hasDrugTest ?? true,
            hasMisdemeanor: data.hasMisdemeanor ?? false,
            currentSalary: data.currentSalary ?? null,
            salaryExpectation: data.salaryExpectation || "Negotiable",
            noticeRequired: data.noticeRequired || "2 weeks",
            preferredWorkType: data.preferredWorkType || "Full-time",
            willingShifts: data.willingShifts || "Day",
            willingOvertime: data.willingOvertime ?? true,
            willingWeekends: data.willingWeekends ?? true,
            remotePreference: data.remotePreference || "Hybrid",
            pronouns: data.pronouns || "",
            hispanicLatino: data.hispanicLatino || "Decline to answer",
            ageRange: data.ageRange || "Decline to answer",
            hasNursingLicense: data.hasNursingLicense ?? false,
            nursingLicenseState: data.nursingLicenseState || "",
            hasCPR: data.hasCPR ?? false,
            hasBLS: data.hasBLS ?? false,
            hasMedicalExperience: data.hasMedicalExperience ?? null,
            hasReferences: data.hasReferences ?? true,
            referenceName1: data.referenceName1 || "",
            referenceEmail1: data.referenceEmail1 || "",
            referencePhone1: data.referencePhone1 || "",
          });
        }
      } catch {
        toast.error("Failed to load answers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reset]);

  async function onSubmit(data: FormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/application-answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          desiredSalary: data.desiredSalary ? Number(data.desiredSalary) : null,
          yearsOfExperience: Number(data.yearsOfExperience),
        }),
      });
      if (res.ok) {
        toast.success("Application answers saved! Redirecting to auto-apply...");
        setTimeout(() => router.push("/auto-apply"), 1500);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to save answers");
      }
    } catch {
      toast.error("Failed to save answers");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Application Questions</h1>
          <p className="text-muted-foreground text-sm">
            Pre-fill common job application answers so auto-apply can fill them
            in automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Section 1: Work Authorization */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5" />
              Work Authorization
            </CardTitle>
            <CardDescription>
              Your eligibility to work in the United States
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="Are you legally authorized to work in the United States?"
              value={values.authorizedToWork}
              onChange={(v) => setValue("authorizedToWork", v)}
            />
            <Toggle
              label="Will you now or in the future require sponsorship?"
              value={values.requireSponsorship}
              onChange={(v) => setValue("requireSponsorship", v)}
            />
          </CardContent>
        </Card>

        {/* Section 2: Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="Are you at least 18 years of age?"
              value={values.isOver18}
              onChange={(v) => setValue("isOver18", v)}
            />
            <Toggle
              label="Do you have a valid driver's license?"
              value={values.hasDriversLicense}
              onChange={(v) => setValue("hasDriversLicense", v)}
            />
            <Toggle
              label="Have you ever been convicted of a felony?"
              value={values.hasFelonyConviction}
              onChange={(v) => setValue("hasFelonyConviction", v)}
            />
          </CardContent>
        </Card>

        {/* Section 3: Job Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Job Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Desired annual salary</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="e.g. 65000"
                  {...register("desiredSalary", { valueAsNumber: true })}
                />
              </div>
            </div>

            <FormSelect
              label="When can you start?"
              value={values.availableStartDate}
              onChange={(v) => setValue("availableStartDate", v)}
              options={["Immediately", "2 weeks", "1 month", "Other"]}
            />

            <div className="space-y-2">
              <Label>Total years of professional experience</Label>
              <Input
                type="number"
                min={0}
                max={50}
                {...register("yearsOfExperience", { valueAsNumber: true })}
              />
            </div>

            <FormSelect
              label="Highest level of education"
              value={values.highestEducation}
              onChange={(v) => setValue("highestEducation", v)}
              options={[
                "High School",
                "Associate's",
                "Bachelor's",
                "Master's",
                "Doctorate",
              ]}
            />

            <Toggle
              label="Are you willing to relocate?"
              value={values.willingToRelocate}
              onChange={(v) => setValue("willingToRelocate", v)}
            />
            <Toggle
              label="Are you willing to travel?"
              value={values.willingToTravel}
              onChange={(v) => setValue("willingToTravel", v)}
            />

            <FormSelect
              label="How did you hear about us?"
              value={values.howDidYouHear}
              onChange={(v) => setValue("howDidYouHear", v)}
              options={[
                "Job Board",
                "LinkedIn",
                "Company Website",
                "Referral",
                "Other",
              ]}
            />
          </CardContent>
        </Card>

        {/* Section 4: EEO Voluntary Disclosures */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5" />
              EEO Voluntary Disclosures
            </CardTitle>
            <CardDescription>
              <Badge variant="outline" className="text-xs">
                Voluntary
              </Badge>{" "}
              These questions are voluntary and will not affect your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSelect
              label="Gender"
              value={values.gender}
              onChange={(v) => setValue("gender", v)}
              options={[
                "Male",
                "Female",
                "Non-binary",
                "Decline to answer",
              ]}
            />
            <FormSelect
              label="Race / Ethnicity"
              value={values.race}
              onChange={(v) => setValue("race", v)}
              options={[
                "American Indian or Alaska Native",
                "Asian",
                "Black or African American",
                "Hispanic or Latino",
                "Native Hawaiian or Other Pacific Islander",
                "White",
                "Two or More Races",
                "Decline to answer",
              ]}
            />
            <FormSelect
              label="Veteran Status"
              value={values.veteranStatus}
              onChange={(v) => setValue("veteranStatus", v)}
              options={["Veteran", "Not a Veteran", "Decline to answer"]}
            />
            <FormSelect
              label="Disability Status"
              value={values.disabilityStatus}
              onChange={(v) => setValue("disabilityStatus", v)}
              options={["Yes", "No", "Decline to answer"]}
            />
          </CardContent>
        </Card>

        {/* Section 5: Additional Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5" />
              Additional Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input
                type="url"
                placeholder="https://linkedin.com/in/yourname"
                {...register("linkedinUrl")}
              />
            </div>
            <div className="space-y-2">
              <Label>Portfolio URL</Label>
              <Input
                type="url"
                placeholder="https://yourportfolio.com"
                {...register("portfolioUrl")}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred name</Label>
              <Input
                placeholder="What you'd like to be called"
                {...register("preferredName")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              Address (Required by Workday)
            </CardTitle>
            <CardDescription>
              Workday and other ATS platforms require your full address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Street address</Label>
              <Input placeholder="123 Main St" {...register("streetAddress")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input placeholder="Houston" {...register("city")} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input placeholder="TX" {...register("state")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zip code</Label>
                <Input placeholder="77084" {...register("zipCode")} />
              </div>
              <FormSelect
                label="Country"
                value={values.country}
                onChange={(v) => setValue("country", v)}
                options={["United States", "Canada", "United Kingdom", "Mexico", "Other"]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Visa & Work Authorization */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="h-5 w-5" />
              Visa & Work Authorization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSelect
              label="Visa Status"
              value={values.visaStatus}
              onChange={(v) => setValue("visaStatus", v)}
              options={[
                "US Citizen",
                "Permanent Resident (Green Card)",
                "H-1B Visa",
                "F-1 OPT",
                "F-1 STEM OPT",
                "L-1 Visa",
                "TN Visa",
                "Other",
              ]}
            />
          </CardContent>
        </Card>

        {/* Section 8: Background Checks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              Background Checks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="OK with background check?"
              value={values.hasBackgroundCheck}
              onChange={(v) => setValue("hasBackgroundCheck", v)}
            />
            <Toggle
              label="OK with drug test?"
              value={values.hasDrugTest}
              onChange={(v) => setValue("hasDrugTest", v)}
            />
            <Toggle
              label="Have you been convicted of a misdemeanor?"
              value={values.hasMisdemeanor}
              onChange={(v) => setValue("hasMisdemeanor", v)}
            />
          </CardContent>
        </Card>

        {/* Section 9: Compensation Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5" />
              Compensation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current annual salary (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  className="pl-7"
                  placeholder="e.g. 55000"
                  {...register("currentSalary", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Salary expectation (text)</Label>
              <Input
                placeholder="Negotiable, or e.g. $65,000-$75,000"
                {...register("salaryExpectation")}
              />
            </div>
            <FormSelect
              label="Notice period required"
              value={values.noticeRequired}
              onChange={(v) => setValue("noticeRequired", v)}
              options={["Immediately", "1 week", "2 weeks", "1 month", "2 months"]}
            />
          </CardContent>
        </Card>

        {/* Section 10: Work Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Work Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSelect
              label="Preferred work type"
              value={values.preferredWorkType}
              onChange={(v) => setValue("preferredWorkType", v)}
              options={["Full-time", "Part-time", "Contract", "Temporary", "Internship"]}
            />
            <FormSelect
              label="Willing to work shifts"
              value={values.willingShifts}
              onChange={(v) => setValue("willingShifts", v)}
              options={["Day", "Night", "Rotating", "Weekends", "Any"]}
            />
            <Toggle
              label="Willing to work overtime?"
              value={values.willingOvertime}
              onChange={(v) => setValue("willingOvertime", v)}
            />
            <Toggle
              label="Willing to work weekends?"
              value={values.willingWeekends}
              onChange={(v) => setValue("willingWeekends", v)}
            />
            <FormSelect
              label="Remote preference"
              value={values.remotePreference}
              onChange={(v) => setValue("remotePreference", v)}
              options={["Remote", "Hybrid", "On-site", "No preference"]}
            />
          </CardContent>
        </Card>

        {/* Section 11: Demographics Extended */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Additional Demographics (Voluntary)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormSelect
              label="Pronouns"
              value={values.pronouns || "Decline to answer"}
              onChange={(v) =>
                setValue("pronouns", v === "Decline to answer" ? "" : v)
              }
              options={["he/him", "she/her", "they/them", "Decline to answer"]}
            />
            <FormSelect
              label="Hispanic / Latino origin?"
              value={values.hispanicLatino}
              onChange={(v) => setValue("hispanicLatino", v)}
              options={["Yes", "No", "Decline to answer"]}
            />
            <FormSelect
              label="Age range"
              value={values.ageRange}
              onChange={(v) => setValue("ageRange", v)}
              options={[
                "Under 18",
                "18-24",
                "25-34",
                "35-44",
                "45-54",
                "55-64",
                "65+",
                "Decline to answer",
              ]}
            />
          </CardContent>
        </Card>

        {/* Section 12: Healthcare Credentials */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="h-5 w-5" />
              Healthcare Credentials (if applicable)
            </CardTitle>
            <CardDescription>
              For nursing, medical, and clinical roles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              label="Do you have an active nursing license?"
              value={values.hasNursingLicense}
              onChange={(v) => setValue("hasNursingLicense", v)}
            />
            {values.hasNursingLicense && (
              <div className="space-y-2">
                <Label>Nursing license state</Label>
                <Input placeholder="TX" {...register("nursingLicenseState")} />
              </div>
            )}
            <Toggle
              label="CPR certified?"
              value={values.hasCPR}
              onChange={(v) => setValue("hasCPR", v)}
            />
            <Toggle
              label="BLS certified?"
              value={values.hasBLS}
              onChange={(v) => setValue("hasBLS", v)}
            />
            <div className="space-y-2">
              <Label>Years of medical/clinical experience</Label>
              <Input
                type="number"
                min={0}
                max={50}
                placeholder="0"
                {...register("hasMedicalExperience", { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 13: References */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Professional Reference (Optional)
            </CardTitle>
            <CardDescription>
              We'll provide this when applications request a reference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle
              label="Do you have references available upon request?"
              value={values.hasReferences}
              onChange={(v) => setValue("hasReferences", v)}
            />
            <div className="space-y-2">
              <Label>Reference name</Label>
              <Input placeholder="Jane Smith" {...register("referenceName1")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference email</Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  {...register("referenceEmail1")}
                />
              </div>
              <div className="space-y-2">
                <Label>Reference phone</Label>
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  {...register("referencePhone1")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-[160px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Answers
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
