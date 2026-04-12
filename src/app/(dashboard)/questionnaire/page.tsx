"use client";

import { useState, useEffect } from "react";
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
        toast.success("Application answers saved successfully");
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
