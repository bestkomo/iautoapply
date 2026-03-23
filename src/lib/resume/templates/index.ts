import { ModernTemplate } from "./modern";
import { ClassicTemplate } from "./classic";
import { MinimalTemplate } from "./minimal";
import { ExecutiveTemplate } from "./executive";
import type { TemplateProps } from "../types";

export interface TemplateConfig {
  name: string;
  component: React.ComponentType<TemplateProps>;
  description: string;
}

export const templates: Record<string, TemplateConfig> = {
  modern: {
    name: "Modern",
    component: ModernTemplate,
    description: "Clean and contemporary",
  },
  classic: {
    name: "Classic",
    component: ClassicTemplate,
    description: "Traditional and formal",
  },
  minimal: {
    name: "Minimal",
    component: MinimalTemplate,
    description: "Simple and elegant",
  },
  executive: {
    name: "Executive",
    component: ExecutiveTemplate,
    description: "Bold and authoritative",
  },
};

export { ModernTemplate, ClassicTemplate, MinimalTemplate, ExecutiveTemplate };
