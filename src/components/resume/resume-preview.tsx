"use client";

import { templates } from "@/lib/resume/templates";
import type { ResumeContent } from "@/lib/resume/types";

interface ResumePreviewProps {
  content: ResumeContent;
  templateId: string;
  scale?: number;
}

export function ResumePreview({ content, templateId, scale = 0.6 }: ResumePreviewProps) {
  const template = templates[templateId] || templates.modern;
  const TemplateComponent = template.component;

  return (
    <div className="bg-muted/30 rounded-lg p-4 flex items-start justify-center overflow-auto min-h-0">
      <div
        className="origin-top-left bg-white shadow-lg rounded"
        style={{
          transform: `scale(${scale})`,
          width: `${100 / scale}%`,
          maxWidth: `${816 / scale}px`,
        }}
      >
        <div className="p-8 min-h-[1056px]" id="resume-preview-content">
          <TemplateComponent content={content} />
        </div>
      </div>
    </div>
  );
}
