"use client";

import type { TemplateProps } from "../types";

export function ClassicTemplate({ content }: TemplateProps) {
  const { personalInfo, summary, experience, education, skills, certifications } = content;

  return (
    <div className="bg-white text-gray-900 font-serif print:text-[11px]">
      {/* Header */}
      <div className="text-center border-b border-gray-400 pb-4 mb-6">
        <h1 className="text-3xl font-bold tracking-wide print:text-2xl">
          {personalInfo.name.toUpperCase()}
        </h1>
        {personalInfo.headline && (
          <p className="text-base text-gray-600 mt-1 italic">{personalInfo.headline}</p>
        )}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-600">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && (
            <>
              <span className="text-gray-400">|</span>
              <span>{personalInfo.phone}</span>
            </>
          )}
          {personalInfo.location && (
            <>
              <span className="text-gray-400">|</span>
              <span>{personalInfo.location}</span>
            </>
          )}
          {personalInfo.linkedin && (
            <>
              <span className="text-gray-400">|</span>
              <span>{personalInfo.linkedin}</span>
            </>
          )}
          {personalInfo.portfolio && (
            <>
              <span className="text-gray-400">|</span>
              <span>{personalInfo.portfolio}</span>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-2 uppercase tracking-wider">
            Professional Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wider">
            Professional Experience
          </h2>
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-sm">{exp.title}</h3>
                  <span className="text-sm text-gray-500 italic">{exp.dates}</span>
                </div>
                <p className="text-sm text-gray-600 italic">
                  {exp.company}
                  {exp.location && `, ${exp.location}`}
                </p>
                <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
                  {exp.bullets.map((bullet, j) => (
                    <li key={j} className="text-sm text-gray-700">
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
        <div className="mb-5">
          <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wider">
            Education
          </h2>
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <h3 className="font-bold text-sm">{edu.degree}</h3>
                  <p className="text-sm text-gray-600 italic">
                    {edu.institution}
                    {edu.gpa && ` - GPA: ${edu.gpa}`}
                  </p>
                </div>
                <span className="text-sm text-gray-500 italic">{edu.dates}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      <div className="mb-5">
        <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wider">
          Skills
        </h2>
        <div className="space-y-1.5 text-sm">
          {skills.technical.length > 0 && (
            <p>
              <span className="font-semibold">Technical: </span>
              {skills.technical.join(", ")}
            </p>
          )}
          {skills.soft.length > 0 && (
            <p>
              <span className="font-semibold">Soft Skills: </span>
              {skills.soft.join(", ")}
            </p>
          )}
          {skills.tools.length > 0 && (
            <p>
              <span className="font-semibold">Tools & Platforms: </span>
              {skills.tools.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Certifications */}
      {certifications && certifications.length > 0 && (
        <div>
          <h2 className="text-base font-bold border-b border-gray-300 pb-1 mb-3 uppercase tracking-wider">
            Certifications
          </h2>
          <div className="space-y-1.5">
            {certifications.map((cert, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  <span className="font-semibold">{cert.name}</span>
                  <span className="text-gray-600"> - {cert.issuer}</span>
                </span>
                {cert.date && <span className="text-gray-500 italic">{cert.date}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
