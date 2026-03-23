"use client";

import { templates } from "@/lib/resume/templates";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, FileText, BookOpen, Minus, Award } from "lucide-react";

const templateIcons: Record<string, React.ReactNode> = {
  modern: <FileText className="h-8 w-8" />,
  classic: <BookOpen className="h-8 w-8" />,
  minimal: <Minus className="h-8 w-8" />,
  executive: <Award className="h-8 w-8" />,
};

const templateColors: Record<string, string> = {
  modern: "from-blue-500 to-blue-600",
  classic: "from-gray-600 to-gray-700",
  minimal: "from-slate-400 to-slate-500",
  executive: "from-amber-500 to-amber-600",
};

interface TemplateSelectorProps {
  selected: string;
  onSelect: (templateId: string) => void;
}

export function TemplateSelector({ selected, onSelect }: TemplateSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.entries(templates).map(([id, template]) => (
        <Card
          key={id}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
            selected === id
              ? "ring-2 ring-primary shadow-md"
              : "hover:ring-1 hover:ring-primary/30"
          )}
          onClick={() => onSelect(id)}
        >
          {selected === id && (
            <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-0.5">
              <Check className="h-3.5 w-3.5" />
            </div>
          )}
          <CardContent className="p-0">
            {/* Preview Thumbnail */}
            <div
              className={cn(
                "h-28 flex items-center justify-center bg-gradient-to-br text-white",
                templateColors[id]
              )}
            >
              {templateIcons[id]}
            </div>
            {/* Info */}
            <div className="p-3">
              <CardTitle className="text-sm">{template.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {template.description}
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
