"use client";

import type { TemplateProps } from "../types";

export function MinimalTemplate({ content }: TemplateProps) {
  const { personalInfo, summary, experience, education, skills, certifications } = content;

  return (
    <div className="bg-white text-gray-800 font-sans print:text-[11px]">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-light text-gray-900 print:text-3xl">
          {personalInfo.name}
        </h1>
        {personalInfo.headline && (
          <p className="text-base text-gray-400 mt-2 font-light">{personalInfo.headline}</p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs text-gray-400 tracking-wide">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.portfolio && <span>{personalInfo.portfolio}</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-10">
          <p className="text-sm leading-7 text-gray-600 font-light max-w-2xl">{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
            Experience
          </h2>
          <div className="space-y-6">
            {experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-medium text-gray-900">{exp.title}</h3>
                  <span className="text-xs text-gray-400">{exp.dates}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  {exp.company}
                  {exp.location && ` / ${exp.location}`}
                </p>
                <ul className="space-y-1">
                  {exp.bullets.map((bullet, j) => (
                    <li key={j} className="text-sm text-gray-600 font-light leading-relaxed pl-3 border-l border-gray-200">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
            Education
          </h2>
          <div className="space-y-4">
            {education.map((edu, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{edu.degree}</h3>
                  <p className="text-xs text-gray-400">
                    {edu.institution}
                    {edu.gpa && ` / GPA: ${edu.gpa}`}
                  </p>
                </div>
                <span className="text-xs text-gray-400">{edu.dates}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="mb-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
          Skills
        </h2>
        <div className="space-y-3">
          {skills.technical.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Technical</p>
              <p className="text-sm text-gray-600 font-light">{skills.technical.join(" / ")}</p>
            </div>
          )}
          {skills.soft.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Soft Skills</p>
              <p className="text-sm text-gray-600 font-light">{skills.soft.join(" / ")}</p>
            </div>
          )}
          {skills.tools.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1.5">Tools</p>
              <p className="text-sm text-gray-600 font-light">{skills.tools.join(" / ")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Certifications */}
      {certifications && certifications.length > 0 && (
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 mb-6">
            Certifications
          </h2>
          <div className="space-y-2">
            {certifications.map((cert, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="font-light text-gray-600">
                  {cert.name}
                  <span className="text-gray-400"> - {cert.issuer}</span>
                </span>
                {cert.date && <span className="text-xs text-gray-400">{cert.date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
