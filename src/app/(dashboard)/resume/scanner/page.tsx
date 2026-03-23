"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ScanSearch,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  X,
} from "lucide-react";
import Link from "next/link";

interface ScanResult {
  overallScore: number;
  sections: {
    format: { score: number; issues: string[]; suggestions: string[] };
    content: { score: number; issues: string[]; suggestions: string[] };
    keywords: {
      score: number;
      matched: string[];
      missing: string[];
      suggestions: string[];
    };
    impact: {
      score: number;
      weakBullets: string[];
      improvedVersions: string[];
      suggestions: string[];
    };
  };
  topImprovements: string[];
  strengths: string[];
}

export default function ScannerPage() {
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setFileName(file.name);

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const text = await file.text();
      setResumeText(text);
      return;
    }

    // For PDF/DOCX, send to server for proper parsing
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resume/parse", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setResumeText(data.text || "");
      } else {
        const err = await res.json().catch(() => ({ error: "Parse failed" }));
        console.error("File parse error:", err.error);
        // Fallback: try reading as text
        const text = await file.text();
        setResumeText(text);
      }
    } catch (error) {
      console.error("File upload error:", error);
      const text = await file.text();
      setResumeText(text);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  async function scanResume() {
    if (!resumeText.trim()) return;

    setScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/ai/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobDescription: jobDescription || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } finally {
      setScanning(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  }

  function getScoreProgressColor(score: number) {
    if (score >= 80) return "[&>div]:bg-green-500";
    if (score >= 60) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-red-500";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/resume">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Resume Scanner</h1>
          <p className="text-muted-foreground text-sm">
            Analyze your resume for ATS optimization and get actionable feedback
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Resume</CardTitle>
              <CardDescription>
                Upload a PDF, DOCX, or paste your resume text below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">
                  {fileName ? (
                    <span className="flex items-center justify-center gap-2">
                      <FileText className="h-4 w-4" />
                      {fileName}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileName(null);
                          setResumeText("");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ) : (
                    "Drag and drop your resume here, or click to browse"
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, DOCX, or TXT (max 5MB)
                </p>
              </div>

              <div>
                <Label className="text-sm">Or paste resume text</Label>
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your entire resume text here..."
                  rows={8}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Job (Optional)</CardTitle>
              <CardDescription>
                Add a job description for keyword matching analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description you're targeting..."
                rows={5}
              />
            </CardContent>
          </Card>

          <Button
            onClick={scanResume}
            disabled={scanning || !resumeText.trim()}
            className="w-full"
            size="lg"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning Resume...
              </>
            ) : (
              <>
                <ScanSearch className="h-4 w-4 mr-2" />
                Scan Resume
              </>
            )}
          </Button>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {!result && !scanning && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <ScanSearch className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  No scan results yet
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your resume and click scan to get started
                </p>
              </CardContent>
            </Card>
          )}

          {scanning && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium">Analyzing your resume...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a few seconds
                </p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              {/* Overall Score */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-muted/30"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeDasharray={`${(result.overallScore / 100) * 264} 264`}
                          strokeLinecap="round"
                          className={getScoreColor(result.overallScore)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl font-bold ${getScoreColor(result.overallScore)}`}>
                          {result.overallScore}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">Overall ATS Score</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {result.overallScore >= 80
                          ? "Your resume is well-optimized for ATS systems."
                          : result.overallScore >= 60
                            ? "Your resume needs some improvements for better ATS performance."
                            : "Your resume needs significant improvements for ATS compatibility."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Top Improvements */}
              {result.topImprovements.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Top Improvements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.topImprovements.map((imp, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="bg-amber-100 text-amber-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs font-bold">
                            {i + 1}
                          </span>
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Section Scores */}
              {Object.entries(result.sections).map(([key, section]) => (
                <Card key={key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base capitalize">{key}</CardTitle>
                      <Badge
                        variant="secondary"
                        className={
                          section.score >= 80
                            ? "bg-green-100 text-green-800"
                            : section.score >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }
                      >
                        {section.score}/100
                      </Badge>
                    </div>
                    <Progress
                      value={section.score}
                      className={`h-1.5 ${getScoreProgressColor(section.score)}`}
                    />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {"issues" in section && section.issues.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">Issues</p>
                        <ul className="space-y-1">
                          {section.issues.map((issue, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {section.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Suggestions
                        </p>
                        <ul className="space-y-1">
                          {section.suggestions.map((sug, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                              {sug}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Keyword specifics */}
                    {"matched" in section && (
                      <div>
                        <Separator className="my-2" />
                        {(section as ScanResult["sections"]["keywords"]).matched.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Matched Keywords
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {(section as ScanResult["sections"]["keywords"]).matched.map(
                                (kw, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs bg-green-50 text-green-700">
                                    {kw}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        {(section as ScanResult["sections"]["keywords"]).missing.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Missing Keywords
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {(section as ScanResult["sections"]["keywords"]).missing.map(
                                (kw, i) => (
                                  <Badge key={i} variant="outline" className="text-xs text-red-600 border-red-200">
                                    {kw}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Impact specifics */}
                    {"weakBullets" in section &&
                      (section as ScanResult["sections"]["impact"]).weakBullets.length > 0 && (
                        <div>
                          <Separator className="my-2" />
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            Weak Bullets &rarr; Improved
                          </p>
                          <div className="space-y-2">
                            {(section as ScanResult["sections"]["impact"]).weakBullets.map(
                              (wb, i) => (
                                <div key={i} className="text-xs space-y-1 p-2 bg-muted/30 rounded">
                                  <p className="text-red-600 line-through">{wb}</p>
                                  {(section as ScanResult["sections"]["impact"]).improvedVersions[
                                    i
                                  ] && (
                                    <p className="text-green-700">
                                      {
                                        (section as ScanResult["sections"]["impact"])
                                          .improvedVersions[i]
                                      }
                                    </p>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
