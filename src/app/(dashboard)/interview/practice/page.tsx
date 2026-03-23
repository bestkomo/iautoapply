"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InterviewChat } from "@/components/interview/interview-chat";
import { InterviewFeedback } from "@/components/interview/interview-feedback";
import {
  ArrowLeft,
  Play,
  Square,
  Loader2,
  MessageSquare,
  Code,
  Briefcase,
} from "lucide-react";
import Link from "next/link";

type InterviewType = "behavioral" | "technical" | "case";
type Phase = "setup" | "interview" | "feedback";

interface Message {
  role: "assistant" | "user";
  content: string;
}

const interviewTypes: {
  value: InterviewType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: "behavioral",
    label: "Behavioral",
    description: "STAR method, leadership, teamwork",
    icon: MessageSquare,
  },
  {
    value: "technical",
    label: "Technical",
    description: "Coding, system design, domain knowledge",
    icon: Code,
  },
  {
    value: "case",
    label: "Case Study",
    description: "Business analysis, problem-solving",
    icon: Briefcase,
  },
];

export default function InterviewPracticePage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [interviewType, setInterviewType] =
    useState<InterviewType>("behavioral");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const startInterview = useCallback(async () => {
    if (!jobTitle.trim()) return;
    setIsLoading(true);
    setPhase("interview");
    setStreamingText("");

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          company: company.trim() || undefined,
          type: interviewType,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        full += text;

        const sessionMatch = full.match(/__SESSION_ID__:(.+)$/);
        if (sessionMatch) {
          setSessionId(sessionMatch[1].trim());
          const cleanText = full.replace(/\n\n__SESSION_ID__:.+$/, "");
          setStreamingText(cleanText);
        } else {
          setStreamingText(full);
        }
      }

      const sessionMatch = full.match(/__SESSION_ID__:(.+)$/);
      const cleanText = full.replace(/\n\n__SESSION_ID__:.+$/, "");
      if (sessionMatch) {
        setSessionId(sessionMatch[1].trim());
      }
      setMessages([{ role: "assistant", content: cleanText }]);
      setStreamingText("");
    } catch (err) {
      console.error("Failed to start interview:", err);
    } finally {
      setIsLoading(false);
    }
  }, [jobTitle, company, interviewType]);

  const sendMessage = useCallback(
    async (answer: string) => {
      if (!sessionId) return;
      setIsLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: answer }]);
      setStreamingText("");

      try {
        const res = await fetch("/api/ai/interview", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, answer }),
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          setStreamingText(full);
        }

        setMessages((prev) => [...prev, { role: "assistant", content: full }]);
        setStreamingText("");
      } catch (err) {
        console.error("Failed to send message:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  const endInterview = useCallback(async () => {
    if (!sessionId) return;
    setFeedbackLoading(true);

    try {
      const res = await fetch("/api/ai/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeedback(data);
      setPhase("feedback");
    } catch (err) {
      console.error("Failed to get feedback:", err);
    } finally {
      setFeedbackLoading(false);
    }
  }, [sessionId]);

  if (phase === "feedback" && feedback) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/interview">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Interview Feedback</h1>
            <p className="text-muted-foreground text-sm">
              {jobTitle}
              {company && ` at ${company}`} - {interviewType} interview
            </p>
          </div>
        </div>
        <InterviewFeedback
          feedback={
            feedback as {
              overallScore: number;
              strengths: string[];
              areasToImprove: string[];
              questionBreakdown: {
                question: string;
                score: number;
                feedback: string;
              }[];
              tips: string[];
              overallFeedback: string;
            }
          }
        />
      </div>
    );
  }

  if (phase === "interview") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/interview">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="font-semibold text-sm">
                {jobTitle}
                {company && ` at ${company}`}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">
                {interviewType} Interview
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={endInterview}
            disabled={feedbackLoading || messages.length < 2}
          >
            {feedbackLoading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Square className="mr-1 h-4 w-4" />
                End Interview
              </>
            )}
          </Button>
        </div>

        <InterviewChat
          messages={messages}
          isLoading={isLoading}
          streamingText={streamingText}
          onSendMessage={sendMessage}
          disabled={feedbackLoading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/interview">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Practice Interview</h1>
          <p className="text-muted-foreground text-sm">
            Set up your mock interview session
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview Setup</CardTitle>
          <CardDescription>
            Configure your practice interview session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title *</Label>
            <Input
              id="jobTitle"
              placeholder="e.g., Senior Software Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              placeholder="e.g., Google"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Interview Type</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {interviewTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setInterviewType(t.value)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    interviewType === t.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-muted-foreground/30"
                  }`}
                >
                  <t.icon
                    className={`h-5 w-5 mb-2 ${
                      interviewType === t.value
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={startInterview}
            disabled={!jobTitle.trim()}
            className="w-full"
            size="lg"
          >
            <Play className="mr-2 h-4 w-4" />
            Start Interview
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
