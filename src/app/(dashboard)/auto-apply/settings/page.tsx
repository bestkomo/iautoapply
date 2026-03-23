"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, X, Plus } from "lucide-react";
import Link from "next/link";

interface Resume {
  id: string;
  title: string;
  isDefault: boolean;
}

interface Preferences {
  maxAutoApplyDay: number;
  desiredTitles: string[];
  desiredLocations: string[];
  remoteOnly: boolean;
  salaryMin: number | null;
  skills: string[];
  excludeCompanies: string[];
}

export default function AutoApplySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [autoGenerateCoverLetter, setAutoGenerateCoverLetter] = useState(true);

  // Preference fields
  const [maxPerDay, setMaxPerDay] = useState(10);
  const [desiredTitles, setDesiredTitles] = useState<string[]>([]);
  const [desiredLocations, setDesiredLocations] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState(50);
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>([]);

  // Tag input state
  const [titleInput, setTitleInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [companyInput, setCompanyInput] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [prefRes, resumeRes] = await Promise.all([
          fetch("/api/profile/preferences"),
          fetch("/api/cover-letters").catch(() => null), // Fallback
        ]);

        if (prefRes.ok) {
          const pref: Preferences = await prefRes.json();
          setMaxPerDay(pref.maxAutoApplyDay || 10);
          setDesiredTitles(pref.desiredTitles || []);
          setDesiredLocations(pref.desiredLocations || []);
          setRemoteOnly(pref.remoteOnly || false);
          setExcludeCompanies(pref.excludeCompanies || []);
        }

        // Fetch resumes (basic attempt)
        try {
          const rRes = await fetch("/api/profile");
          if (rRes.ok) {
            // Will use the default resume selection later
          }
        } catch {
          // Ignore
        }

        // Stub: In a real app, we'd fetch resumes from /api/resumes
        if (resumeRes && resumeRes.ok) {
          // Not a resume endpoint - skip
        }
      } catch {
        // Handle error
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function addTag(
    list: string[],
    setter: (v: string[]) => void,
    value: string,
    inputSetter: (v: string) => void
  ) {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
    inputSetter("");
  }

  function removeTag(
    list: string[],
    setter: (v: string[]) => void,
    value: string
  ) {
    setter(list.filter((v2) => v2 !== value));
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    list: string[],
    setter: (v: string[]) => void,
    value: string,
    inputSetter: (v: string) => void
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(list, setter, value, inputSetter);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxAutoApplyDay: maxPerDay,
          desiredTitles,
          desiredLocations,
          remoteOnly,
          excludeCompanies,
        }),
      });
      if (res.ok) {
        router.push("/auto-apply");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/auto-apply">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Auto Apply Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your automated job application preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Application Limits */}
        <Card>
          <CardHeader>
            <CardTitle>Application Limits</CardTitle>
            <CardDescription>
              Control how many applications are sent per day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max applications per day: {maxPerDay}</Label>
              <input
                type="range"
                min={1}
                max={50}
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>25</span>
                <span>50</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Minimum match score: {minMatchScore}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minMatchScore}
                onChange={(e) => setMinMatchScore(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resume & Cover Letter */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Choose which documents to use for auto-applications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Resume</Label>
              <Select
                value={selectedResumeId}
                onValueChange={(v) => setSelectedResumeId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Use default resume" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use default resume</SelectItem>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoGenCL"
                checked={autoGenerateCoverLetter}
                onCheckedChange={(checked) =>
                  setAutoGenerateCoverLetter(checked === true)
                }
              />
              <Label htmlFor="autoGenCL" className="cursor-pointer">
                Auto-generate cover letter for each application
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Target Job Titles */}
        <Card>
          <CardHeader>
            <CardTitle>Target Job Titles</CardTitle>
            <CardDescription>
              The job titles you want to apply for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Software Engineer"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    desiredTitles,
                    setDesiredTitles,
                    titleInput,
                    setTitleInput
                  )
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  addTag(
                    desiredTitles,
                    setDesiredTitles,
                    titleInput,
                    setTitleInput
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {desiredTitles.map((title) => (
                <Badge key={title} variant="secondary" className="gap-1">
                  {title}
                  <button
                    onClick={() =>
                      removeTag(desiredTitles, setDesiredTitles, title)
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Target Locations */}
        <Card>
          <CardHeader>
            <CardTitle>Target Locations</CardTitle>
            <CardDescription>Preferred job locations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="remoteOnly"
                checked={remoteOnly}
                onCheckedChange={(checked) => setRemoteOnly(checked === true)}
              />
              <Label htmlFor="remoteOnly" className="cursor-pointer">
                Remote only
              </Label>
            </div>
            {!remoteOnly && (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. San Francisco, CA"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) =>
                      handleKeyDown(
                        e,
                        desiredLocations,
                        setDesiredLocations,
                        locationInput,
                        setLocationInput
                      )
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      addTag(
                        desiredLocations,
                        setDesiredLocations,
                        locationInput,
                        setLocationInput
                      )
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {desiredLocations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="gap-1">
                      {loc}
                      <button
                        onClick={() =>
                          removeTag(
                            desiredLocations,
                            setDesiredLocations,
                            loc
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Excluded Companies */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Excluded Companies</CardTitle>
            <CardDescription>
              Companies you do not want to apply to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="e.g. Company Name"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    excludeCompanies,
                    setExcludeCompanies,
                    companyInput,
                    setCompanyInput
                  )
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  addTag(
                    excludeCompanies,
                    setExcludeCompanies,
                    companyInput,
                    setCompanyInput
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {excludeCompanies.map((company) => (
                <Badge key={company} variant="secondary" className="gap-1">
                  {company}
                  <button
                    onClick={() =>
                      removeTag(
                        excludeCompanies,
                        setExcludeCompanies,
                        company
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
