"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ResumeContent } from "@/lib/resume/types";

interface ResumeEditorProps {
  content: ResumeContent;
  onChange: (content: ResumeContent) => void;
}

export function ResumeEditor({ content, onChange }: ResumeEditorProps) {
  const { register, control, watch, setValue } = useForm<ResumeContent>({
    defaultValues: content,
  });

  const {
    fields: expFields,
    append: appendExp,
    remove: removeExp,
    move: moveExp,
  } = useFieldArray({ control, name: "experience" });

  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
    move: moveEdu,
  } = useFieldArray({ control, name: "education" });

  const {
    fields: certFields,
    append: appendCert,
    remove: removeCert,
  } = useFieldArray({ control, name: "certifications" });

  const handleChange = useCallback(
    (data: ResumeContent) => {
      onChange(data);
    },
    [onChange]
  );

  useEffect(() => {
    const subscription = watch((data) => {
      handleChange(data as ResumeContent);
    });
    return () => subscription.unsubscribe();
  }, [watch, handleChange]);

  // Sync external content changes
  useEffect(() => {
    const current = watch();
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      Object.entries(content).forEach(([key, value]) => {
        setValue(key as keyof ResumeContent, value);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className="space-y-4 pb-8">
      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input {...register("personalInfo.name")} placeholder="John Doe" />
            </div>
            <div>
              <Label className="text-xs">Headline</Label>
              <Input
                {...register("personalInfo.headline")}
                placeholder="Senior Software Engineer"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                {...register("personalInfo.email")}
                placeholder="john@example.com"
                type="email"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input {...register("personalInfo.phone")} placeholder="+1 (555) 123-4567" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Location</Label>
              <Input {...register("personalInfo.location")} placeholder="San Francisco, CA" />
            </div>
            <div>
              <Label className="text-xs">LinkedIn</Label>
              <Input {...register("personalInfo.linkedin")} placeholder="linkedin.com/in/johndoe" />
            </div>
            <div>
              <Label className="text-xs">Portfolio</Label>
              <Input {...register("personalInfo.portfolio")} placeholder="johndoe.com" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Professional Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register("summary")}
            placeholder="Write a 2-3 sentence professional summary..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Experience */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Experience</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendExp({
                title: "",
                company: "",
                location: "",
                dates: "",
                bullets: [""],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {expFields.map((field, index) => (
            <div key={field.id} className="relative border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Position {index + 1}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => moveExp(index, index - 1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {index < expFields.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => moveExp(index, index + 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeExp(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Job Title</Label>
                  <Input
                    {...register(`experience.${index}.title`)}
                    placeholder="Software Engineer"
                  />
                </div>
                <div>
                  <Label className="text-xs">Company</Label>
                  <Input
                    {...register(`experience.${index}.company`)}
                    placeholder="Acme Corp"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Location</Label>
                  <Input
                    {...register(`experience.${index}.location`)}
                    placeholder="San Francisco, CA"
                  />
                </div>
                <div>
                  <Label className="text-xs">Dates</Label>
                  <Input
                    {...register(`experience.${index}.dates`)}
                    placeholder="Jan 2020 - Present"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bullet Points</Label>
                <Controller
                  control={control}
                  name={`experience.${index}.bullets`}
                  render={({ field: bulletsField }) => (
                    <BulletEditor
                      bullets={bulletsField.value || [""]}
                      onChange={bulletsField.onChange}
                    />
                  )}
                />
              </div>
            </div>
          ))}
          {expFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No experience added yet. Click &quot;Add&quot; to add a position.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Education</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              appendEdu({ degree: "", institution: "", dates: "", gpa: null })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {eduFields.map((field, index) => (
            <div key={field.id} className="relative border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Education {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => moveEdu(index, index - 1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {index < eduFields.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => moveEdu(index, index + 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeEdu(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Degree</Label>
                  <Input
                    {...register(`education.${index}.degree`)}
                    placeholder="B.S. Computer Science"
                  />
                </div>
                <div>
                  <Label className="text-xs">Institution</Label>
                  <Input
                    {...register(`education.${index}.institution`)}
                    placeholder="Stanford University"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Dates</Label>
                  <Input
                    {...register(`education.${index}.dates`)}
                    placeholder="2016 - 2020"
                  />
                </div>
                <div>
                  <Label className="text-xs">GPA (optional)</Label>
                  <Input
                    {...register(`education.${index}.gpa`)}
                    placeholder="3.8"
                  />
                </div>
              </div>
            </div>
          ))}
          {eduFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No education added yet. Click &quot;Add&quot; to add an entry.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Technical Skills (comma-separated)</Label>
            <Controller
              control={control}
              name="skills.technical"
              render={({ field }) => (
                <Input
                  value={field.value?.join(", ") || ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="React, TypeScript, Node.js, Python"
                />
              )}
            />
          </div>
          <div>
            <Label className="text-xs">Soft Skills (comma-separated)</Label>
            <Controller
              control={control}
              name="skills.soft"
              render={({ field }) => (
                <Input
                  value={field.value?.join(", ") || ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Leadership, Communication, Problem Solving"
                />
              )}
            />
          </div>
          <div>
            <Label className="text-xs">Tools & Platforms (comma-separated)</Label>
            <Controller
              control={control}
              name="skills.tools"
              render={({ field }) => (
                <Input
                  value={field.value?.join(", ") || ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="AWS, Docker, Git, Jira"
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Certifications</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendCert({ name: "", issuer: "", date: "" })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {certFields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-3 border rounded-lg p-3">
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input
                    {...register(`certifications.${index}.name`)}
                    placeholder="AWS Solutions Architect"
                  />
                </div>
                <div>
                  <Label className="text-xs">Issuer</Label>
                  <Input
                    {...register(`certifications.${index}.issuer`)}
                    placeholder="Amazon"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    {...register(`certifications.${index}.date`)}
                    placeholder="2023"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-5 h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => removeCert(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {certFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No certifications. Click &quot;Add&quot; to add one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Bullet point sub-editor
function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  const addBullet = () => onChange([...bullets, ""]);

  const removeBullet = (index: number) => {
    const next = bullets.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
  };

  const updateBullet = (index: number, value: string) => {
    const next = [...bullets];
    next[index] = value;
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
          <Input
            value={bullet}
            onChange={(e) => updateBullet(i, e.target.value)}
            placeholder="Led a team of 5 engineers to deliver..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeBullet(i)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={addBullet} className="text-xs">
        <Plus className="h-3 w-3 mr-1" />
        Add bullet
      </Button>
    </div>
  );
}
