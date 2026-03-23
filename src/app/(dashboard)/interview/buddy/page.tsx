"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Zap,
  Loader2,
  Copy,
  Check,
  Clock,
  Lightbulb,
  List,
  Star,
} from "lucide-react";
import Link from "next/link";

interface BuddyResponse {
  question: string;
  suggestions: string;
  timestamp: Date;
}

export default function InterviewBuddyPage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState<string>("");
  const [history, setHistory] = useState<BuddyResponse[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || isLoading) return;
    setIsLoading(true);
    setCurrentResponse("");

    try {
      const res = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: "the role",
          type: "behavioral",
          aiProvider: "openai",
        }),
      });

      // Use the networking endpoint for buddy functionality
      const buddyRes = await fetch("/api/ai/networking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "follow_up",
          context: `I need help answering this interview question. Provide:
1. KEY TALKING POINTS (3-5 bullet points)
2. SUGGESTED ANSWER STRUCTURE (outline format)
3. RELEVANT EXPERIENCE TO MENTION (general tips)
4. THINGS TO AVOID

Question: "${q}"

Format your response with clear sections using headers.`,
        }),
      });

      // Fallback: read the stream from the first response or use the networking response
      let responseText = "";
      if (buddyRes.ok) {
        const data = await buddyRes.json();
        responseText = data.text || data.message || JSON.stringify(data);
      } else {
        // Read from the interview stream and ignore the sessionId
        const reader = res.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            responseText += decoder.decode(value, { stream: true });
          }
          responseText = responseText.replace(/\n\n__SESSION_ID__:.+$/, "");
        }
      }

      setCurrentResponse(responseText);
      setHistory((prev) => [
        { question: q, suggestions: responseText, timestamp: new Date() },
        ...prev,
      ]);
      setQuestion("");
    } catch (err) {
      console.error("Failed to get suggestions:", err);
      setCurrentResponse("Failed to generate suggestions. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [question, isLoading]);

  const copyToClipboard = useCallback(
    async (text: string, index: number) => {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    },
    []
  );

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Interview Buddy
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
              Live
            </Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            Get instant help during your real interview
          </p>
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-yellow-500" />
            Paste Your Question
          </CardTitle>
          <CardDescription>
            Paste the question you just received and get instant talking points
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g., Tell me about a time when you had to deal with a difficult team member..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            onClick={handleAsk}
            disabled={!question.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating suggestions...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Get Talking Points
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Current Response */}
      {currentResponse && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Suggestions
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(currentResponse, -1)}
              >
                {copiedIndex === -1 ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {currentResponse}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Tips */}
      {!currentResponse && !isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <List className="h-8 w-8 text-blue-500 mb-3" />
              <h3 className="font-medium text-sm mb-1">Structure</h3>
              <p className="text-xs text-muted-foreground">
                Get a clear answer structure with an opening, body, and
                conclusion format.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Star className="h-8 w-8 text-purple-500 mb-3" />
              <h3 className="font-medium text-sm mb-1">Key Points</h3>
              <p className="text-xs text-muted-foreground">
                Receive specific talking points and experiences to mention in
                your answer.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 text-yellow-500 mb-3" />
              <h3 className="font-medium text-sm mb-1">Speed</h3>
              <p className="text-xs text-muted-foreground">
                Powered by GPT-4o for ultra-fast responses when you need help in
                real time.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session History</CardTitle>
            <CardDescription>
              Questions asked during this session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {history.map((item, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-sm">{item.question}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyToClipboard(item.suggestions, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded bg-muted p-3">
                    <p className="text-sm whitespace-pre-wrap line-clamp-4">
                      {item.suggestions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
