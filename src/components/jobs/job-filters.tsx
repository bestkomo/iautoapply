"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, X } from "lucide-react";

export interface JobFilters {
  q: string;
  location: string;
  remote: boolean;
  sources: string[];
  jobTypes: string[];
  salaryMin: string;
  salaryMax: string;
}

interface JobFiltersProps {
  filters: JobFilters;
  onChange: (filters: JobFilters) => void;
  onReset: () => void;
}

const SOURCES = [
  { value: "INDEED", label: "Indeed" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "GLASSDOOR", label: "Glassdoor" },
  { value: "REMOTEOK", label: "RemoteOK" },
  { value: "WEWORKREMOTELY", label: "We Work Remotely" },
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "LEVER", label: "Lever" },
];

const JOB_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "INTERNSHIP", label: "Internship" },
];

export function JobFiltersPanel({ filters, onChange, onReset }: JobFiltersProps) {
  function updateFilter<K extends keyof JobFilters>(key: K, value: JobFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleArrayValue(key: "sources" | "jobTypes", value: string) {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, updated);
  }

  const hasActiveFilters =
    filters.q ||
    filters.location ||
    filters.remote ||
    filters.sources.length > 0 ||
    filters.jobTypes.length > 0 ||
    filters.salaryMin ||
    filters.salaryMax;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Filters</CardTitle>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Job title, company..."
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>Location</Label>
          <div className="relative">
            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="City, state, country..."
              value={filters.location}
              onChange={(e) => updateFilter("location", e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Remote Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remote"
            checked={filters.remote}
            onCheckedChange={(checked) =>
              updateFilter("remote", checked === true)
            }
          />
          <Label htmlFor="remote" className="cursor-pointer">
            Remote only
          </Label>
        </div>

        {/* Sources */}
        <div className="space-y-2">
          <Label>Source</Label>
          <div className="space-y-2">
            {SOURCES.map((source) => (
              <div key={source.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`source-${source.value}`}
                  checked={filters.sources.includes(source.value)}
                  onCheckedChange={() =>
                    toggleArrayValue("sources", source.value)
                  }
                />
                <Label
                  htmlFor={`source-${source.value}`}
                  className="text-sm cursor-pointer"
                >
                  {source.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Job Type */}
        <div className="space-y-2">
          <Label>Job Type</Label>
          <div className="space-y-2">
            {JOB_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type.value}`}
                  checked={filters.jobTypes.includes(type.value)}
                  onCheckedChange={() =>
                    toggleArrayValue("jobTypes", type.value)
                  }
                />
                <Label
                  htmlFor={`type-${type.value}`}
                  className="text-sm cursor-pointer"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Salary Range */}
        <div className="space-y-2">
          <Label>Salary Range (USD)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.salaryMin}
              onChange={(e) => updateFilter("salaryMin", e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.salaryMax}
              onChange={(e) => updateFilter("salaryMax", e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
