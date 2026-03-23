"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

interface QuestionBreakdown {
  question: string;
  score: number;
  feedback: string;
}

interface InterviewFeedbackData {
  overallScore: number;
  strengths: string[];
  areasToImprove: string[];
  questionBreakdown: QuestionBreakdown[];
  tips: string[];
  overallFeedback: string;
}

interface InterviewFeedbackProps {
  feedback: InterviewFeedbackData;
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
        ? "text-yellow-500"
        : "text-red-500";
  const strokeColor =
    score >= 80
      ? "stroke-green-500"
      : score >= 60
        ? "stroke-yellow-500"
        : "stroke-red-500";

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        className="-rotate-90"
      >
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth="10"
        />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          className={strokeColor}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}

function QuestionScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : score >= 6
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      {score}/10
    </span>
  );
}

export function InterviewFeedback({ feedback }: InterviewFeedbackProps) {
  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Interview Performance</CardTitle>
          <CardDescription>{feedback.overallFeedback}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <ScoreGauge score={feedback.overallScore} />
        </CardContent>
      </Card>

      {/* Strengths & Improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {feedback.strengths.map((s, i) => (
                <Badge
                  key={i}
                  className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Areas to Improve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {feedback.areasToImprove.map((a, i) => (
                <Badge
                  key={i}
                  className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0"
                >
                  {a}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Question Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Question-by-Question Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {feedback.questionBreakdown.map((q, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-sm">
                    Q{i + 1}: {q.question}
                  </p>
                  <QuestionScoreBadge score={q.score} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {q.feedback}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Tips for Next Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feedback.tips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
