"use client";

import type { TemplateProps } from "../types";

export function ModernTemplate({ content }: TemplateProps) {
  const { personalInfo, summary, experience, education, skills, certifications } = content;

  return (
    <div className="bg-white text-gray-900 font-sans print:text-[11px]">
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">
          {personalInfo.name}
        </h1>
        {personalInfo.headline && (
          <p className="text-lg text-blue-600 mt-1 font-medium print:text-base">
            {personalInfo.headline}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.portfolio && <span>{personalInfo.portfolio}</span>}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-2">
            Professional Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
            Experience
          </h2>
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{exp.title}</h3>
                    <p className="text-sm text-gray-600">
                      {exp.company}
                      {exp.location && <span> &middot; {exp.location}</span>}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
                    {exp.dates}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {exp.bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="text-sm text-gray-700 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[0.55em] before:w-1.5 before:h-1.5 before:bg-blue-400 before:rounded-full"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column: Education + Skills */}
      <div className="grid grid-cols-2 gap-8 print:gap-6">
        {/* Education */}
        <div>
          {education.length > 0 && (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
                Education
              </h2>
              <div className="space-y-3">
                {education.map((edu, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-sm text-gray-900">{edu.degree}</h3>
                    <p className="text-sm text-gray-600">{edu.institution}</p>
                    <p className="text-xs text-gray-500">
                      {edu.dates}
                      {edu.gpa && <span> &middot; GPA: {edu.gpa}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Certifications */}
          {certifications && certifications.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
                Certifications
              </h2>
              <div className="space-y-2">
                {certifications.map((cert, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-gray-900">{cert.name}</p>
                    <p className="text-xs text-gray-500">
                      {cert.issuer}
                      {cert.date && <span> &middot; {cert.date}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Skills */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-3">
            Skills
          </h2>
          {skills.technical.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Technical
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.technical.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {skills.soft.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Soft Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.soft.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-md"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {skills.tools.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                Tools & Platforms
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.tools.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-md"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
