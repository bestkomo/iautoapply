"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewCoverLetterPage() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState<"professional" | "enthusiastic" | "concise">("professional");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    if (!jobTitle || !company || !jobDescription) return;
    setGenerating(true);
    setContent("");

    try {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, company, jobDescription, tone }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setContent(fullText);
      }

      // Auto-set title if empty
      if (!title) {
        setTitle(`Cover Letter - ${jobTitle} at ${company}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setContent(`Error: ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!title || !content) return;
    setSaving(true);

    try {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, jobTitle, company }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/cover-letter/${data.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cover-letter">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Cover Letter</h1>
          <p className="text-muted-foreground mt-1">
            Generate a tailored cover letter with AI
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  placeholder="e.g. Senior Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="e.g. Google"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobDescription">Job Description</Label>
                <Textarea
                  id="jobDescription"
                  placeholder="Paste the full job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <RadioGroup
                  value={tone}
                  onValueChange={(v) => setTone(v as typeof tone)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="professional" id="professional" />
                    <Label htmlFor="professional" className="cursor-pointer">
                      Professional
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="enthusiastic" id="enthusiastic" />
                    <Label htmlFor="enthusiastic" className="cursor-pointer">
                      Enthusiastic
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="concise" id="concise" />
                    <Label htmlFor="concise" className="cursor-pointer">
                      Concise
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!jobTitle || !company || !jobDescription || generating}
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
                    Generate with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Editor & Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cover Letter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Cover letter title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Tabs defaultValue="edit">
                <TabsList className="w-full">
                  <TabsTrigger value="edit" className="flex-1">
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">
                    Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="edit">
                  <Textarea
                    placeholder={
                      generating
                        ? "Generating cover letter..."
                        : "Your cover letter will appear here..."
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={16}
                    className="font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-[384px] rounded-md border p-4 bg-background">
                    {content ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {content}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center mt-16">
                        Nothing to preview yet
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <Button
                onClick={handleSave}
                disabled={!title || !content || saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Cover Letter
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
