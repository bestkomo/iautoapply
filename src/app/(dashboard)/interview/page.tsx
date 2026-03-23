"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Zap,
  Trophy,
  Clock,
  ArrowRight,
} from "lucide-react";

interface InterviewSessionSummary {
  id: string;
  jobTitle: string;
  company: string | null;
  type: string;
  score: number | null;
  duration: number | null;
  createdAt: string;
}

export default function InterviewPage() {
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/interviews")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const completedSessions = sessions.filter((s) => s.score !== null);
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) /
            completedSessions.length
        )
      : null;

  const typeColors: Record<string, string> = {
    behavioral: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    technical: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    case: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Interview Prep</h1>
        <p className="text-muted-foreground mt-1">
          Practice interviews and get real-time coaching
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/interview/practice">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-pink-100 p-2.5 dark:bg-pink-900/30">
                  <MessageSquare className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <CardTitle>Practice Interview</CardTitle>
                  <CardDescription>
                    Full mock interview with AI feedback
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Simulate real interviews with behavioral, technical, or case
                questions. Get detailed feedback and scoring after each session.
              </p>
              <div className="mt-3 flex items-center text-sm font-medium text-primary">
                Start practicing <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/interview/buddy">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-100 p-2.5 dark:bg-yellow-900/30">
                  <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <CardTitle>Interview Buddy</CardTitle>
                  <CardDescription>
                    Real-time help during interviews
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Paste questions you receive during real interviews and get
                instant talking points, suggested structures, and key points.
              </p>
              <div className="mt-3 flex items-center text-sm font-medium text-primary">
                Get started <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions Completed</CardDescription>
            <CardTitle className="text-3xl">
              {completedSessions.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Score</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {avgScore !== null ? (
                <>
                  {avgScore}
                  <Trophy
                    className={`h-5 w-5 ${
                      avgScore >= 80
                        ? "text-green-500"
                        : avgScore >= 60
                          ? "text-yellow-500"
                          : "text-red-500"
                    }`}
                  />
                </>
              ) : (
                "--"
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sessions</CardDescription>
            <CardTitle className="text-3xl">{sessions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Best Score</CardDescription>
            <CardTitle className="text-3xl">
              {completedSessions.length > 0
                ? Math.max(...completedSessions.map((s) => s.score ?? 0))
                : "--"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Past Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Past Sessions</CardTitle>
          <CardDescription>Review your interview history</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-10 w-10 mb-3 opacity-50" />
              <p>No interview sessions yet.</p>
              <p className="text-sm">
                Start a practice interview to see your history here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {s.jobTitle}
                      {s.company && (
                        <span className="text-muted-foreground">
                          {" "}
                          at {s.company}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[s.type] || "bg-muted"}`}
                      >
                        {s.type}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {s.score !== null ? (
                      <span
                        className={`text-lg font-bold ${
                          s.score >= 80
                            ? "text-green-500"
                            : s.score >= 60
                              ? "text-yellow-500"
                              : "text-red-500"
                        }`}
                      >
                        {s.score}/100
                      </span>
                    ) : (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
