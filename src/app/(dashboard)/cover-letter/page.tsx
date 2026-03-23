"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, MoreVertical, Trash2, Edit, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CoverLetter {
  id: string;
  title: string;
  content: string;
  jobTitle: string | null;
  company: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CoverLetterListPage() {
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoverLetters();
  }, []);

  async function fetchCoverLetters() {
    try {
      const res = await fetch("/api/cover-letters");
      const data = await res.json();
      setCoverLetters(data.coverLetters || []);
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this cover letter?")) return;
    await fetch(`/api/cover-letters/${id}`, { method: "DELETE" });
    setCoverLetters((prev) => prev.filter((cl) => cl.id !== id));
  }

  async function handleDuplicate(cl: CoverLetter) {
    const res = await fetch("/api/cover-letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${cl.title} (Copy)`,
        content: cl.content,
        jobTitle: cl.jobTitle,
        company: cl.company,
      }),
    });
    if (res.ok) {
      fetchCoverLetters();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Cover Letters</h1>
            <p className="text-muted-foreground mt-1">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cover Letters</h1>
          <p className="text-muted-foreground mt-1">
            {coverLetters.length} cover letter{coverLetters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/cover-letter/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Cover Letter
          </Button>
        </Link>
      </div>

      {coverLetters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No cover letters yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI-generated cover letter
            </p>
            <Link href="/cover-letter/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Cover Letter
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coverLetters.map((cl) => (
            <Card key={cl.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1 flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    <Link
                      href={`/cover-letter/${cl.id}`}
                      className="hover:underline"
                    >
                      {cl.title}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {cl.company && cl.jobTitle
                      ? `${cl.jobTitle} at ${cl.company}`
                      : cl.company || cl.jobTitle || "General"}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href={`/cover-letter/${cl.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(cl)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(cl.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {cl.content.slice(0, 150)}...
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" className="text-xs">
                    {new Date(cl.updatedAt).toLocaleDateString()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
