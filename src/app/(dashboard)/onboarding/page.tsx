"use client";

import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Settings2,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  personalInfoSchema,
  experienceSchema,
  educationSchema,
  skillSchema,
  preferencesSchema,
  type PersonalInfoData,
  type ExperienceData,
  type EducationData,
  type SkillData,
  type PreferencesData,
} from "@/lib/validators/profile";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExperienceEntry extends ExperienceData {
  id?: string;
}

interface EducationEntry extends EducationData {
  id?: string;
}

interface SkillEntry extends SkillData {
  id?: string;
}

type StepId =
  | "personal"
  | "experience"
  | "education"
  | "skills"
  | "preferences";

interface StepConfig {
  id: StepId;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepConfig[] = [
  { id: "personal", label: "Personal Info", icon: <User className="size-4" /> },
  {
    id: "experience",
    label: "Experience",
    icon: <Briefcase className="size-4" />,
  },
  {
    id: "education",
    label: "Education",
    icon: <GraduationCap className="size-4" />,
  },
  { id: "skills", label: "Skills", icon: <Wrench className="size-4" /> },
  {
    id: "preferences",
    label: "Preferences",
    icon: <Settings2 className="size-4" />,
  },
];

const JOB_TYPE_OPTIONS = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "INTERNSHIP", label: "Internship" },
] as const;

const SKILL_LEVELS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "EXPERT", label: "Expert" },
] as const;

// ---------------------------------------------------------------------------
// Tag Input component
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = input.trim();
      if (value && !tags.includes(value)) {
        onAdd(value);
        setInput("");
      }
    }
    if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {tags.map((tag, i) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : "Add more..."}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 - Personal Info
// ---------------------------------------------------------------------------

function PersonalInfoStep({
  data,
  onSave,
  saving,
}: {
  data: PersonalInfoData;
  onSave: (d: PersonalInfoData) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalInfoData>({
    resolver: zodResolver(personalInfoSchema) as any,
    defaultValues: data,
  });

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5">
      <div className="space-y-4">
        <div>
          <Label htmlFor="headline">Professional Headline</Label>
          <Input
            id="headline"
            placeholder="e.g. Senior Full Stack Developer"
            {...register("headline")}
            className="mt-1.5"
          />
          {errors.headline && (
            <p className="mt-1 text-xs text-destructive">
              {errors.headline.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="summary">Professional Summary</Label>
          <Textarea
            id="summary"
            placeholder="Brief overview of your professional background..."
            {...register("summary")}
            className="mt-1.5"
            rows={4}
          />
          {errors.summary && (
            <p className="mt-1 text-xs text-destructive">
              {errors.summary.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="+1 (555) 123-4567"
              {...register("phone")}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="San Francisco, CA"
              {...register("location")}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              placeholder="https://linkedin.com/in/..."
              {...register("linkedinUrl")}
              className="mt-1.5"
            />
            {errors.linkedinUrl && (
              <p className="mt-1 text-xs text-destructive">
                {errors.linkedinUrl.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="portfolioUrl">Portfolio URL</Label>
            <Input
              id="portfolioUrl"
              placeholder="https://yoursite.com"
              {...register("portfolioUrl")}
              className="mt-1.5"
            />
            {errors.portfolioUrl && (
              <p className="mt-1 text-xs text-destructive">
                {errors.portfolioUrl.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="githubUrl">GitHub URL</Label>
            <Input
              id="githubUrl"
              placeholder="https://github.com/..."
              {...register("githubUrl")}
              className="mt-1.5"
            />
            {errors.githubUrl && (
              <p className="mt-1 text-xs text-destructive">
                {errors.githubUrl.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save &amp; Continue
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 - Experience
// ---------------------------------------------------------------------------

function ExperienceStep({
  entries,
  onSave,
  onDelete,
  saving,
  onNext,
}: {
  entries: ExperienceEntry[];
  onSave: (d: ExperienceData) => Promise<void>;
  onDelete: (id: string) => void;
  saving: boolean;
  onNext: () => void;
}) {
  const [showForm, setShowForm] = useState(entries.length === 0);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExperienceData>({
    resolver: zodResolver(experienceSchema) as any,
    defaultValues: {
      current: false,
      bullets: [],
    },
  });

  const current = watch("current");
  const [bulletInput, setBulletInput] = useState("");
  const [bullets, setBullets] = useState<string[]>([]);

  const addBullet = () => {
    const trimmed = bulletInput.trim();
    if (trimmed) {
      const next = [...bullets, trimmed];
      setBullets(next);
      setValue("bullets", next);
      setBulletInput("");
    }
  };

  const removeBullet = (i: number) => {
    const next = bullets.filter((_, idx) => idx !== i);
    setBullets(next);
    setValue("bullets", next);
  };

  const onSubmit = async (data: ExperienceData) => {
    await onSave({ ...data, bullets });
    reset();
    setBullets([]);
    setBulletInput("");
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((exp) => (
            <Card key={exp.id} className="relative p-4">
              <button
                type="button"
                onClick={() => exp.id && onDelete(exp.id)}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <h4 className="font-semibold">{exp.title}</h4>
              <p className="text-sm text-muted-foreground">
                {exp.company}
                {exp.location ? ` - ${exp.location}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {exp.startDate
                  ? new Date(exp.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
                {" - "}
                {exp.current
                  ? "Present"
                  : exp.endDate
                    ? new Date(exp.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
              </p>
              {exp.bullets && exp.bullets.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                  {exp.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card className="p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="exp-title">Job Title *</Label>
                <Input
                  id="exp-title"
                  placeholder="Software Engineer"
                  {...register("title")}
                  className="mt-1.5"
                />
                {errors.title && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="exp-company">Company *</Label>
                <Input
                  id="exp-company"
                  placeholder="Acme Inc."
                  {...register("company")}
                  className="mt-1.5"
                />
                {errors.company && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.company.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="exp-location">Location</Label>
              <Input
                id="exp-location"
                placeholder="San Francisco, CA"
                {...register("location")}
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="exp-start">Start Date *</Label>
                <Input
                  id="exp-start"
                  type="month"
                  {...register("startDate")}
                  className="mt-1.5"
                />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-destructive">
                    Start date is required
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="exp-end">End Date</Label>
                <Input
                  id="exp-end"
                  type="month"
                  {...register("endDate")}
                  className="mt-1.5"
                  disabled={current}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={current}
                onCheckedChange={(checked: boolean) =>
                  setValue("current", checked)
                }
              />
              <Label className="cursor-pointer text-sm font-normal">
                I currently work here
              </Label>
            </div>

            <div>
              <Label htmlFor="exp-description">Description</Label>
              <Textarea
                id="exp-description"
                placeholder="Brief description of your role..."
                {...register("description")}
                className="mt-1.5"
                rows={2}
              />
            </div>

            <div>
              <Label>Key Achievements / Bullets</Label>
              <div className="mt-1.5 space-y-2">
                {bullets.map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-sm"
                  >
                    <span className="flex-1">{b}</span>
                    <button
                      type="button"
                      onClick={() => removeBullet(i)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={bulletInput}
                    onChange={(e) => setBulletInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBullet();
                      }
                    }}
                    placeholder="Add a bullet point and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addBullet}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Experience
              </Button>
              {entries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                    setBullets([]);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="mr-2 size-4" />
          Add Experience
        </Button>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Continue
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 - Education
// ---------------------------------------------------------------------------

function EducationStep({
  entries,
  onSave,
  onDelete,
  saving,
  onNext,
}: {
  entries: EducationEntry[];
  onSave: (d: EducationData) => Promise<void>;
  onDelete: (id: string) => void;
  saving: boolean;
  onNext: () => void;
}) {
  const [showForm, setShowForm] = useState(entries.length === 0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EducationData>({
    resolver: zodResolver(educationSchema) as any,
  });

  const onSubmit = async (data: EducationData) => {
    await onSave(data);
    reset();
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((edu) => (
            <Card key={edu.id} className="relative p-4">
              <button
                type="button"
                onClick={() => edu.id && onDelete(edu.id)}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
              <h4 className="font-semibold">
                {edu.degree}
                {edu.field ? ` in ${edu.field}` : ""}
              </h4>
              <p className="text-sm text-muted-foreground">{edu.institution}</p>
              <p className="text-xs text-muted-foreground">
                {edu.startDate
                  ? new Date(edu.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })
                  : ""}
                {edu.endDate
                  ? ` - ${new Date(edu.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                  : ""}
                {edu.gpa ? ` | GPA: ${edu.gpa}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}

      {showForm ? (
        <Card className="p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edu-institution">Institution *</Label>
                <Input
                  id="edu-institution"
                  placeholder="Stanford University"
                  {...register("institution")}
                  className="mt-1.5"
                />
                {errors.institution && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.institution.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edu-degree">Degree *</Label>
                <Input
                  id="edu-degree"
                  placeholder="Bachelor of Science"
                  {...register("degree")}
                  className="mt-1.5"
                />
                {errors.degree && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.degree.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edu-field">Field of Study</Label>
                <Input
                  id="edu-field"
                  placeholder="Computer Science"
                  {...register("field")}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edu-gpa">GPA</Label>
                <Input
                  id="edu-gpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  placeholder="3.8"
                  {...register("gpa", { valueAsNumber: true })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edu-start">Start Date *</Label>
                <Input
                  id="edu-start"
                  type="month"
                  {...register("startDate")}
                  className="mt-1.5"
                />
                {errors.startDate && (
                  <p className="mt-1 text-xs text-destructive">
                    Start date is required
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edu-end">End Date</Label>
                <Input
                  id="edu-end"
                  type="month"
                  {...register("endDate")}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edu-description">Description</Label>
              <Textarea
                id="edu-description"
                placeholder="Relevant coursework, activities, honors..."
                {...register("description")}
                className="mt-1.5"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Education
              </Button>
              {entries.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="mr-2 size-4" />
          Add Education
        </Button>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Continue
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 - Skills
// ---------------------------------------------------------------------------

function SkillsStep({
  skills,
  onSave,
  saving,
}: {
  skills: SkillEntry[];
  onSave: (skills: SkillData[]) => void;
  saving: boolean;
}) {
  const [localSkills, setLocalSkills] = useState<SkillData[]>(skills);
  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillData["level"]>("INTERMEDIATE");
  const [skillCategory, setSkillCategory] = useState("");

  const addSkill = () => {
    const name = skillName.trim();
    if (!name) return;
    if (localSkills.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      return;

    setLocalSkills([
      ...localSkills,
      {
        name,
        level: skillLevel,
        category: skillCategory.trim() || undefined,
      },
    ]);
    setSkillName("");
    setSkillCategory("");
  };

  const removeSkill = (index: number) => {
    setLocalSkills(localSkills.filter((_, i) => i !== index));
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "BEGINNER":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "INTERMEDIATE":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "ADVANCED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "EXPERT":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {localSkills.map((skill, i) => (
          <span
            key={`${skill.name}-${i}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${levelColor(skill.level)}`}
          >
            {skill.name}
            <span className="text-[10px] opacity-70">
              {skill.level.charAt(0) + skill.level.slice(1).toLowerCase()}
            </span>
            <button
              type="button"
              onClick={() => removeSkill(i)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {localSkills.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No skills added yet. Add your technical and professional skills
            below.
          </p>
        )}
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div>
            <Label htmlFor="skill-name" className="text-xs">
              Skill Name
            </Label>
            <Input
              id="skill-name"
              value={skillName}
              onChange={(e) => setSkillName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. React, Python, Project Management"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="skill-level" className="text-xs">
              Level
            </Label>
            <select
              id="skill-level"
              value={skillLevel}
              onChange={(e) =>
                setSkillLevel(e.target.value as SkillData["level"])
              }
              className="mt-1 flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="skill-category" className="text-xs">
              Category
            </Label>
            <Input
              id="skill-category"
              value={skillCategory}
              onChange={(e) => setSkillCategory(e.target.value)}
              placeholder="e.g. Frontend"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={addSkill}
              disabled={!skillName.trim()}
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => onSave(localSkills)}
          disabled={saving}
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save &amp; Continue
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 - Preferences
// ---------------------------------------------------------------------------

function PreferencesStep({
  data,
  onSave,
  saving,
}: {
  data: PreferencesData;
  onSave: (d: PreferencesData) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PreferencesData>({
    resolver: zodResolver(preferencesSchema) as any,
    defaultValues: data,
  });

  const desiredTitles = watch("desiredTitles") || [];
  const desiredLocations = watch("desiredLocations") || [];
  const excludeCompanies = watch("excludeCompanies") || [];
  const jobTypes = watch("jobTypes") || [];
  const remoteOnly = watch("remoteOnly");

  const toggleJobType = (type: PreferencesData["jobTypes"][number]) => {
    const current = jobTypes || [];
    if (current.includes(type)) {
      setValue(
        "jobTypes",
        current.filter((t) => t !== type)
      );
    } else {
      setValue("jobTypes", [...current, type]);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-5">
      <div>
        <Label>Desired Job Titles</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Type a title and press Enter
        </p>
        <TagInput
          tags={desiredTitles}
          onAdd={(t) => setValue("desiredTitles", [...desiredTitles, t])}
          onRemove={(i) =>
            setValue(
              "desiredTitles",
              desiredTitles.filter((_, idx) => idx !== i)
            )
          }
          placeholder="e.g. Software Engineer, Frontend Developer"
        />
      </div>

      <div>
        <Label>Desired Locations</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Type a location and press Enter
        </p>
        <TagInput
          tags={desiredLocations}
          onAdd={(t) => setValue("desiredLocations", [...desiredLocations, t])}
          onRemove={(i) =>
            setValue(
              "desiredLocations",
              desiredLocations.filter((_, idx) => idx !== i)
            )
          }
          placeholder="e.g. San Francisco, Remote, New York"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={remoteOnly}
          onCheckedChange={(checked: boolean) =>
            setValue("remoteOnly", checked)
          }
        />
        <Label className="cursor-pointer text-sm font-normal">
          Remote only positions
        </Label>
      </div>

      <div>
        <Label htmlFor="salaryMin">Minimum Salary (USD/year)</Label>
        <Input
          id="salaryMin"
          type="number"
          placeholder="e.g. 80000"
          {...register("salaryMin", { valueAsNumber: true })}
          className="mt-1.5 max-w-xs"
        />
      </div>

      <div>
        <Label>Job Types</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {JOB_TYPE_OPTIONS.map((jt) => (
            <button
              key={jt.value}
              type="button"
              onClick={() => toggleJobType(jt.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                jobTypes.includes(jt.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {jt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Companies to Exclude</Label>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Companies you do not want to apply to
        </p>
        <TagInput
          tags={excludeCompanies}
          onAdd={(t) =>
            setValue("excludeCompanies", [...excludeCompanies, t])
          }
          onRemove={(i) =>
            setValue(
              "excludeCompanies",
              excludeCompanies.filter((_, idx) => idx !== i)
            )
          }
          placeholder="e.g. Company Name"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          <Sparkles className="mr-1 size-4" />
          Complete Setup
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Onboarding Page
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form data state
  const [personalInfo, setPersonalInfo] = useState<PersonalInfoData>({});
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [educations, setEducations] = useState<EducationEntry[]>([]);
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [preferences, setPreferences] = useState<PreferencesData>({
    desiredTitles: [],
    desiredLocations: [],
    remoteOnly: false,
    jobTypes: [],
    skills: [],
    excludeCompanies: [],
  });

  // Load existing profile on mount
  useEffect(() => {
    async function load() {
      try {
        const [profileRes, prefsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/profile/preferences"),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile) {
            setPersonalInfo({
              headline: profile.headline || "",
              summary: profile.summary || "",
              phone: profile.phone || "",
              location: profile.location || "",
              linkedinUrl: profile.linkedinUrl || "",
              portfolioUrl: profile.portfolioUrl || "",
              githubUrl: profile.githubUrl || "",
            });
            if (profile.experiences) setExperiences(profile.experiences);
            if (profile.education) setEducations(profile.education);
            if (profile.skills) setSkills(profile.skills);
          }
        }

        if (prefsRes.ok) {
          const prefs = await prefsRes.json();
          if (prefs) {
            setPreferences({
              desiredTitles: prefs.desiredTitles || [],
              desiredLocations: prefs.desiredLocations || [],
              remoteOnly: prefs.remoteOnly || false,
              salaryMin: prefs.salaryMin || undefined,
              jobTypes: prefs.jobTypes || [],
              skills: prefs.skills || [],
              excludeCompanies: prefs.excludeCompanies || [],
            });
          }
        }
      } catch {
        // Silent fail on load - user starts fresh
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Step handlers
  const handleSavePersonalInfo = useCallback(
    async (data: PersonalInfoData) => {
      setSaving(true);
      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save");
        setPersonalInfo(data);
        toast.success("Personal info saved");
        setCurrentStep(1);
      } catch {
        toast.error("Failed to save personal info");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleSaveExperience = useCallback(
    async (data: ExperienceData) => {
      setSaving(true);
      try {
        const res = await fetch("/api/profile/experience", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save");
        const created = await res.json();
        setExperiences((prev) => [...prev, created]);
        toast.success("Experience added");
      } catch {
        toast.error("Failed to save experience");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleDeleteExperience = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/profile/experience?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setExperiences((prev) => prev.filter((e) => e.id !== id));
      toast.success("Experience removed");
    } catch {
      toast.error("Failed to remove experience");
    }
  }, []);

  const handleSaveEducation = useCallback(
    async (data: EducationData) => {
      setSaving(true);
      try {
        const res = await fetch("/api/profile/education", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save");
        const created = await res.json();
        setEducations((prev) => [...prev, created]);
        toast.success("Education added");
      } catch {
        toast.error("Failed to save education");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleDeleteEducation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/profile/education?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setEducations((prev) => prev.filter((e) => e.id !== id));
      toast.success("Education removed");
    } catch {
      toast.error("Failed to remove education");
    }
  }, []);

  const handleSaveSkills = useCallback(async (skillData: SkillData[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: skillData }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSkills(skillData);
      toast.success("Skills saved");
      setCurrentStep(4);
    } catch {
      toast.error("Failed to save skills");
    } finally {
      setSaving(false);
    }
  }, []);

  const handleSavePreferences = useCallback(
    async (data: PreferencesData) => {
      setSaving(true);
      try {
        const res = await fetch("/api/profile/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save");
        setPreferences(data);
        toast.success("Preferences saved! Redirecting to dashboard...");
        setTimeout(() => router.push("/dashboard"), 1500);
      } catch {
        toast.error("Failed to save preferences");
      } finally {
        setSaving(false);
      }
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  const progressPercent = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-3xl py-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Complete Your Profile
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Set up your profile to get personalized job matches and AI-powered
          applications.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">
            Step {currentStep + 1} of {STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(progressPercent)}% complete
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-in-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (index <= currentStep) setCurrentStep(index);
              }}
              disabled={index > currentStep}
              className={`flex flex-col items-center gap-1.5 transition-colors ${
                index > currentStep
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer"
              }`}
            >
              <div
                className={`flex size-10 items-center justify-center rounded-full border-2 transition-all ${
                  isComplete
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={`hidden text-xs sm:block ${
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <Card className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">{STEPS[currentStep].label}</h2>
          <p className="text-sm text-muted-foreground">
            {currentStep === 0 &&
              "Tell us about yourself so employers can learn more about you."}
            {currentStep === 1 &&
              "Add your work experience to showcase your career history."}
            {currentStep === 2 &&
              "Add your educational background and qualifications."}
            {currentStep === 3 &&
              "List the skills and competencies you bring to the table."}
            {currentStep === 4 &&
              "Set your job search preferences to get better matches."}
          </p>
        </div>

        {/* Back button for steps 1+ */}
        {currentStep > 0 && (
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>
          </div>
        )}

        {currentStep === 0 && (
          <PersonalInfoStep
            data={personalInfo}
            onSave={handleSavePersonalInfo}
            saving={saving}
          />
        )}

        {currentStep === 1 && (
          <ExperienceStep
            entries={experiences}
            onSave={handleSaveExperience}
            onDelete={handleDeleteExperience}
            saving={saving}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 2 && (
          <EducationStep
            entries={educations}
            onSave={handleSaveEducation}
            onDelete={handleDeleteEducation}
            saving={saving}
            onNext={() => setCurrentStep(3)}
          />
        )}

        {currentStep === 3 && (
          <SkillsStep
            skills={skills}
            onSave={handleSaveSkills}
            saving={saving}
          />
        )}

        {currentStep === 4 && (
          <PreferencesStep
            data={preferences}
            onSave={handleSavePreferences}
            saving={saving}
          />
        )}
      </Card>

      {/* Skip option */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Skip for now and go to dashboard
        </button>
      </div>
    </div>
  );
}
