"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Trash2, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

interface CoverLetter {
  id: string;
  title: string;
  content: string;
  jobTitle: string | null;
  company: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EditCoverLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetchCoverLetter();
  }, [id]);

  async function fetchCoverLetter() {
    try {
      const res = await fetch(`/api/cover-letters/${id}`);
      if (!res.ok) {
        router.push("/cover-letter");
        return;
      }
      const data: CoverLetter = await res.json();
      setCoverLetter(data);
      setTitle(data.title);
      setContent(data.content);
      setJobTitle(data.jobTitle || "");
      setCompany(data.company || "");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/cover-letters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, jobTitle, company }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetter(data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!jobTitle || !company) return;
    setRegenerating(true);
    setContent("");

    try {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          jobDescription: `Regenerate cover letter for ${jobTitle} at ${company}`,
          tone: "professional",
        }),
      });

      if (!res.ok) throw new Error("Regeneration failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setContent(fullText);
      }
    } catch {
      setContent(coverLetter?.content || "");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this cover letter?")) return;
    await fetch(`/api/cover-letters/${id}`, { method: "DELETE" });
    router.push("/cover-letter");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!coverLetter) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/cover-letter">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Cover Letter</h1>
            <p className="text-muted-foreground mt-1">
              Last updated {new Date(coverLetter.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sidebar: Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <Button
              onClick={handleRegenerate}
              variant="outline"
              className="w-full"
              disabled={!jobTitle || !company || regenerating}
            >
              {regenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Main: Editor */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    className="font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-[480px] rounded-md border p-6 bg-background">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {content}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
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
