"use client";

import type { TemplateProps } from "../types";

export function ExecutiveTemplate({ content }: TemplateProps) {
  const { personalInfo, summary, experience, education, skills, certifications } = content;

  return (
    <div className="bg-white text-gray-900 font-sans print:text-[11px]">
      {/* Bold Header with Accent */}
      <div className="bg-slate-800 text-white px-8 py-6 -mx-0 mb-6 print:bg-slate-800 print:text-white">
        <h1 className="text-3xl font-bold tracking-wide print:text-2xl">
          {personalInfo.name}
        </h1>
        {personalInfo.headline && (
          <p className="text-amber-400 text-lg mt-1 font-medium print:text-base">
            {personalInfo.headline}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-slate-300">
          {personalInfo.email && <span>{personalInfo.email}</span>}
          {personalInfo.phone && <span>{personalInfo.phone}</span>}
          {personalInfo.location && <span>{personalInfo.location}</span>}
          {personalInfo.linkedin && <span>{personalInfo.linkedin}</span>}
          {personalInfo.portfolio && <span>{personalInfo.portfolio}</span>}
        </div>
      </div>

      {/* Executive Summary */}
      {summary && (
        <div className="mb-6 px-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 border-b-2 border-amber-600 pb-1 mb-3">
            Executive Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
        </div>
      )}

      {/* Leadership Experience */}
      {experience.length > 0 && (
        <div className="mb-6 px-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 border-b-2 border-amber-600 pb-1 mb-4">
            Leadership Experience
          </h2>
          <div className="space-y-5">
            {experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{exp.title}</h3>
                    <p className="text-sm font-medium text-slate-600">
                      {exp.company}
                      {exp.location && <span className="font-normal"> | {exp.location}</span>}
                    </p>
                  </div>
                  <span className="text-sm text-slate-500 font-medium whitespace-nowrap ml-4 bg-slate-100 px-3 py-0.5 rounded">
                    {exp.dates}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {exp.bullets.map((bullet, j) => (
                    <li
                      key={j}
                      className="text-sm text-gray-700 pl-5 relative before:content-[''] before:absolute before:left-0 before:top-[0.45em] before:w-2 before:h-0.5 before:bg-amber-500"
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

      {/* Two-Column Bottom */}
      <div className="grid grid-cols-5 gap-6 px-2 print:gap-4">
        {/* Left: Education + Certifications (3 cols) */}
        <div className="col-span-3">
          {education.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 border-b-2 border-amber-600 pb-1 mb-3">
                Education
              </h2>
              <div className="space-y-3">
                {education.map((edu, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-bold text-sm">{edu.degree}</h3>
                      <span className="text-xs text-gray-500">{edu.dates}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {edu.institution}
                      {edu.gpa && <span className="text-gray-500"> | GPA: {edu.gpa}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {certifications && certifications.length > 0 && (
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 border-b-2 border-amber-600 pb-1 mb-3">
                Certifications & Credentials
              </h2>
              <div className="space-y-2">
                {certifications.map((cert, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      <span className="font-semibold">{cert.name}</span>
                      <span className="text-gray-500"> | {cert.issuer}</span>
                    </span>
                    {cert.date && <span className="text-gray-500">{cert.date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Skills (2 cols) */}
        <div className="col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-600 border-b-2 border-amber-600 pb-1 mb-3">
            Core Competencies
          </h2>
          {skills.technical.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-1.5">Technical</h3>
              <div className="space-y-0.5">
                {skills.technical.map((skill, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-700 py-0.5 px-2 bg-slate-50 rounded"
                  >
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}
          {skills.soft.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-1.5">Leadership</h3>
              <div className="space-y-0.5">
                {skills.soft.map((skill, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-700 py-0.5 px-2 bg-amber-50 rounded"
                  >
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}
          {skills.tools.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-1.5">Tools</h3>
              <div className="space-y-0.5">
                {skills.tools.map((skill, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-700 py-0.5 px-2 bg-slate-50 rounded"
                  >
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
