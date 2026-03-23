"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResumeEditor } from "@/components/resume/resume-editor";
import { ResumePreview } from "@/components/resume/resume-preview";
import { templates } from "@/lib/resume/templates";
import {
  ArrowLeft,
  Save,
  Loader2,
  Sparkles,
  Download,
} from "lucide-react";
import type { ResumeContent } from "@/lib/resume/types";

interface ResumeData {
  id: string;
  title: string;
  templateId: string;
  content: ResumeContent;
  language: string;
  atsScore: number | null;
}

export default function EditResumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("modern");
  const [content, setContent] = useState<ResumeContent>({
    personalInfo: { name: "" },
    summary: "",
    experience: [],
    education: [],
    skills: { technical: [], soft: [], tools: [] },
    certifications: [],
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/resumes/${id}`);
        if (!res.ok) {
          router.push("/resume");
          return;
        }
        const data: ResumeData = await res.json();
        setResume(data);
        setTitle(data.title);
        setTemplateId(data.templateId);
        setContent(data.content);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  const handleContentChange = useCallback((newContent: ResumeContent) => {
    setContent(newContent);
  }, []);

  async function saveResume() {
    setSaving(true);
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, templateId, content }),
      });
      if (res.ok) {
        const data = await res.json();
        setResume(data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function enhanceWithAI() {
    setEnhancing(true);
    try {
      const res = await fetch("/api/ai/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) return;

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
        } else return;
      }

      setContent({
        personalInfo: parsed.personalInfo || content.personalInfo,
        summary: parsed.summary || content.summary,
        experience: parsed.experience || content.experience,
        education: parsed.education || content.education,
        skills: parsed.skills || content.skills,
        certifications: parsed.certifications || content.certifications,
      });
    } finally {
      setEnhancing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resume) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/resume")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 w-56"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select value={templateId} onValueChange={(v) => setTemplateId(v ?? "modern")}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(templates).map(([key, tmpl]) => (
                    <SelectItem key={key} value={key}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={enhanceWithAI}
            disabled={enhancing}
          >
            {enhancing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            AI Enhance
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={saveResume} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Split View */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
          <ResumeEditor content={content} onChange={handleContentChange} />
        </div>
        <div className="sticky top-0 max-h-[calc(100vh-200px)] overflow-y-auto">
          <ResumePreview content={content} templateId={templateId} />
        </div>
      </div>
    </div>
  );
}
