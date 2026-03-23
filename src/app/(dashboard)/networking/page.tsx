"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Linkedin,
  Mail,
  UserPlus,
  Heart,
  DollarSign,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ArrowLeft,
  Clock,
  Trash2,
} from "lucide-react";

type NetworkingMessageType =
  | "linkedin_connect"
  | "follow_up"
  | "cold_email"
  | "thank_you"
  | "salary_negotiation";

interface MessageTemplate {
  type: NetworkingMessageType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface HistoryItem {
  type: NetworkingMessageType;
  recipientName: string;
  company: string;
  text: string;
  timestamp: string;
}

const templates: MessageTemplate[] = [
  {
    type: "linkedin_connect",
    label: "LinkedIn Connection",
    description: "Send a personalized connection request",
    icon: Linkedin,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    type: "follow_up",
    label: "Follow-up Message",
    description: "Follow up after connecting or meeting",
    icon: UserPlus,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    type: "cold_email",
    label: "Cold Email",
    description: "Reach out to a recruiter or hiring manager",
    icon: Mail,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    type: "thank_you",
    label: "Thank You Note",
    description: "Send appreciation after an interview",
    icon: Heart,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
  {
    type: "salary_negotiation",
    label: "Salary Negotiation",
    description: "Negotiate your compensation professionally",
    icon: DollarSign,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
];

const HISTORY_KEY = "iautoapply_networking_history";

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
}

export default function NetworkingPage() {
  const [selectedType, setSelectedType] =
    useState<NetworkingMessageType | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientTitle, setRecipientTitle] = useState("");
  const [company, setCompany] = useState("");
  const [context, setContext] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const generate = useCallback(async () => {
    if (!selectedType) return;
    setIsLoading(true);
    setGeneratedText("");

    try {
      const res = await fetch("/api/ai/networking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          recipientName: recipientName.trim() || undefined,
          recipientTitle: recipientTitle.trim() || undefined,
          company: company.trim() || undefined,
          context: context.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratedText(data.text);

      const newItem: HistoryItem = {
        type: selectedType,
        recipientName: recipientName.trim(),
        company: company.trim(),
        text: data.text,
        timestamp: new Date().toISOString(),
      };
      const updated = [newItem, ...history].slice(0, 50);
      setHistory(updated);
      saveHistory(updated);
    } catch (err) {
      console.error("Failed to generate:", err);
      setGeneratedText("Failed to generate message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, recipientName, recipientTitle, company, context, history]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const selectedTemplate = templates.find((t) => t.type === selectedType);

  if (selectedType && selectedTemplate) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedType(null);
              setGeneratedText("");
              setRecipientName("");
              setRecipientTitle("");
              setCompany("");
              setContext("");
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedTemplate.label}</h1>
            <p className="text-muted-foreground text-sm">
              {selectedTemplate.description}
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  placeholder="e.g., Jane Smith"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientTitle">Recipient Title</Label>
                <Input
                  id="recipientTitle"
                  placeholder="e.g., Engineering Manager"
                  value={recipientTitle}
                  onChange={(e) => setRecipientTitle(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="e.g., Google"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Context / Notes</Label>
              <Textarea
                id="context"
                placeholder="Add any additional context, e.g., shared interests, mutual connections, specific role you're interested in..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button
              onClick={generate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Message"
              )}
            </Button>
          </CardContent>
        </Card>

        {generatedText && (
          <Card className="border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Generated Message</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generate}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
                    />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedText)}
                  >
                    {copied ? (
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {generatedText}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Networking Assistant</h1>
        <p className="text-muted-foreground mt-1">
          Generate professional networking messages with AI
        </p>
      </div>

      {/* Template Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => setSelectedType(t.type)}
            className="text-left"
          >
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2.5 ${t.bgColor}`}>
                    <t.icon className={`h-5 w-5 ${t.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.label}</CardTitle>
                    <CardDescription className="text-xs">
                      {t.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </button>
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Message History</CardTitle>
                <CardDescription>
                  Previously generated messages
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-muted-foreground"
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.slice(0, 10).map((item, i) => {
                const template = templates.find(
                  (t) => t.type === item.type
                );
                return (
                  <div
                    key={i}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {template && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${template.bgColor} ${template.color}`}
                          >
                            {template.label}
                          </span>
                        )}
                        {item.recipientName && (
                          <span className="text-sm text-muted-foreground">
                            to {item.recipientName}
                            {item.company && ` at ${item.company}`}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.text}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => copyToClipboard(item.text)}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
