"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TemplateSelector } from "@/components/resume/template-selector";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { ResumePreview } from "@/components/resume/resume-preview";
import { Sparkles, FileText, ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";
import type { ResumeContent } from "@/lib/resume/types";

const emptyContent: ResumeContent = {
  personalInfo: { name: "" },
  summary: "",
  experience: [],
  education: [],
  skills: { technical: [], soft: [], tools: [] },
  certifications: [],
};

type Step = "template" | "method" | "editor";

export default function NewResumePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("template");
  const [templateId, setTemplateId] = useState("modern");
  const [content, setContent] = useState<ResumeContent>(emptyContent);
  const [title, setTitle] = useState("My Resume");
  const [jobDescription, setJobDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleContentChange = useCallback((newContent: ResumeContent) => {
    setContent(newContent);
  }, []);

  async function generateWithAI() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobDescription || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate resume");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      let fullText = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      let parsed: ResumeContent;
      try {
        parsed = JSON.parse(fullText);
      } catch {
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          alert("Failed to parse AI response");
          return;
        }
      }

      // Ensure all required fields exist
      setContent({
        personalInfo: parsed.personalInfo || { name: "" },
        summary: parsed.summary || "",
        experience: parsed.experience || [],
        education: parsed.education || [],
        skills: parsed.skills || { technical: [], soft: [], tools: [] },
        certifications: parsed.certifications || [],
      });

      if (jobDescription) {
        setTitle(`Resume - ${jobDescription.slice(0, 40)}...`);
      }
      setStep("editor");
    } finally {
      setGenerating(false);
    }
  }

  async function saveResume() {
    setSaving(true);
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, templateId, content }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/resume/${data.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save resume");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step === "method") setStep("template");
            else if (step === "editor") setStep("method");
            else router.push("/resume");
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create New Resume</h1>
          <p className="text-muted-foreground text-sm">
            {step === "template" && "Step 1: Choose a template"}
            {step === "method" && "Step 2: Choose how to start"}
            {step === "editor" && "Step 3: Edit your resume"}
          </p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2">
        {(["template", "method", "editor"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-2 flex-1 min-w-[60px] rounded-full ${
                (["template", "method", "editor"] as const).indexOf(step) >= i
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step 1: Template Selection */}
      {step === "template" && (
        <div className="space-y-4">
          <TemplateSelector selected={templateId} onSelect={setTemplateId} />
          <div className="flex justify-end">
            <Button onClick={() => setStep("method")}>
              Continue
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Method Selection */}
      {step === "method" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* AI Generate */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate with AI
              </CardTitle>
              <CardDescription>
                Auto-generate an ATS-optimized resume from your profile. Optionally
                tailor it to a specific job.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Job Description (optional)</Label>
                <Textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here to tailor your resume..."
                  rows={6}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={generateWithAI}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Resume
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Blank */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Start Blank
              </CardTitle>
              <CardDescription>
                Start with an empty resume and fill in each section manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <Button
                  variant="outline"
                  onClick={() => {
                    setContent(emptyContent);
                    setStep("editor");
                  }}
                >
                  Start from Scratch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Editor with Preview */}
      {step === "editor" && (
        <div className="space-y-4">
          {/* Title input and save */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Resume Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your resume a name..."
              />
            </div>
            <Button onClick={saveResume} disabled={saving} className="mt-5">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Resume
            </Button>
          </div>

          {/* Split View */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
              <ResumeEditor content={content} onChange={handleContentChange} />
            </div>
            <div className="sticky top-0 max-h-[calc(100vh-280px)] overflow-y-auto">
              <ResumePreview content={content} templateId={templateId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
