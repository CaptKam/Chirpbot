import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, Star, ChevronDown, Brain, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AiLearningLog {
  id: string;
  sport: string;
  alertType: string;
  gameId: string | null;
  inputData: {
    gameInfo: any;
    weatherData?: any;
    playerStats?: any;
    situationalData?: any;
    originalAlert: {
      type: string;
      title: string;
      description: string;
      confidence: number;
    };
  };
  aiResponse: {
    enhancedTitle?: string;
    enhancedDescription?: string;
    confidence: number;
    reasoning: string;
    tags: string[];
    priority: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    tokensUsed: number;
    processingTimeMs: number;
  } | null;
  success: boolean;
  errorMessage: string | null;
  confidence: number | null;
  userFeedback: number | null;
  userFeedbackText: string | null;
  settings: {
    model: string;
    temperature: number;
    maxTokens: number;
    redactPii: boolean;
  };
  createdAt: string;
}

const SPORTS = ["", "MLB", "NFL", "NBA", "NHL"];
const ALERT_TYPES = [
  "", "Game Start", "7th Inning Warning", "Tie Game 9th Inning", "Close Game",
  "Late Inning Pressure", "Star Batter Alert", "Power Hitter Alert",
  "Elite Hitter in Clutch", "300+ Hitter Alert", "RBI Machine Alert",
  "Runners on Base", "Inning Change", "Weather Alert", "Injury Alert"
];

export function AiLearningLogsPanel() {
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AiLearningLog | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery<AiLearningLog[]>({
    queryKey: ["/api/admin/ai-logs", { sport: selectedSport, alertType: selectedAlertType, limit: 100 }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ logId, feedback, feedbackText }: { logId: string; feedback: number; feedbackText?: string }) => {
      return await apiRequest(`/api/admin/ai-logs/${logId}/feedback`, {
        method: "PATCH",
        body: JSON.stringify({ feedback, feedbackText }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-logs"] });
      toast({
        title: "Feedback Submitted",
        description: "Your feedback has been recorded successfully.",
      });
      setSelectedLog(null);
      setFeedbackRating(0);
      setFeedbackText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Feedback Failed",
        description: error.message || "Failed to submit feedback.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    if (!selectedLog || feedbackRating === 0) return;
    
    feedbackMutation.mutate({
      logId: selectedLog.id,
      feedback: feedbackRating,
      feedbackText: feedbackText.trim() || undefined,
    });
  };

  const getStatusIcon = (log: AiLearningLog) => {
    if (log.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return "text-gray-400";
    if (confidence >= 80) return "text-green-600";
    if (confidence >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return "text-green-600";
      case 'negative': return "text-red-600";
      default: return "text-gray-600";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-sm text-muted-foreground">Loading AI learning logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <Brain className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Learning Logs</h2>
            <p className="text-muted-foreground">Monitor AI interactions and provide feedback</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Filter Logs</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Sport</Label>
              <Select value={selectedSport} onValueChange={setSelectedSport}>
                <SelectTrigger data-testid="select-filter-sport">
                  <SelectValue placeholder="All Sports" />
                </SelectTrigger>
                <SelectContent>
                  {SPORTS.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport || "All Sports"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alert Type</Label>
              <Select value={selectedAlertType} onValueChange={setSelectedAlertType}>
                <SelectTrigger data-testid="select-filter-alert-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map((alertType) => (
                    <SelectItem key={alertType} value={alertType}>
                      {alertType || "All Types"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedSport("");
                  setSelectedAlertType("");
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <div className="grid grid-cols-1 gap-4">
        {logs?.map((log) => (
          <Card key={log.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  {/* Header Row */}
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log)}
                    <Badge variant="secondary">{log.sport}</Badge>
                    <Badge variant="outline">{log.alertType}</Badge>
                    {log.userFeedback && (
                      <div className="flex items-center space-x-1">
                        <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                        <span className="text-sm">{log.userFeedback}/5</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-medium">{log.inputData.originalAlert.title}</h4>
                      <p className="text-sm text-muted-foreground">{log.inputData.originalAlert.description}</p>
                    </div>

                    {log.aiResponse && (
                      <div className="border-l-2 border-blue-200 pl-3 space-y-1">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {log.aiResponse.enhancedTitle || "AI Enhanced"}
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {log.aiResponse.enhancedDescription}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className={getConfidenceColor(log.aiResponse.confidence)}>
                            Confidence: {log.aiResponse.confidence}%
                          </span>
                          <span className={getSentimentColor(log.aiResponse.sentiment)}>
                            {log.aiResponse.sentiment}
                          </span>
                          <span>Tokens: {log.aiResponse.tokensUsed}</span>
                          <span>{log.aiResponse.processingTimeMs}ms</span>
                        </div>
                      </div>
                    )}

                    {log.errorMessage && (
                      <div className="flex items-center space-x-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{log.errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Model: {log.settings.model} • Temp: {log.settings.temperature}%</span>
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        data-testid={`button-view-log-${log.id}`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>AI Learning Log Details</DialogTitle>
                        <DialogDescription>
                          {log.sport} • {log.alertType} • {new Date(log.createdAt).toLocaleString()}
                        </DialogDescription>
                      </DialogHeader>
                      
                      {selectedLog && (
                        <div className="space-y-6">
                          {/* Original Alert */}
                          <div>
                            <h4 className="font-medium mb-2">Original Alert</h4>
                            <div className="bg-muted p-3 rounded-lg space-y-2">
                              <p className="font-medium">{selectedLog.inputData.originalAlert.title}</p>
                              <p className="text-sm">{selectedLog.inputData.originalAlert.description}</p>
                              <p className="text-xs text-muted-foreground">
                                Original Confidence: {selectedLog.inputData.originalAlert.confidence}%
                              </p>
                            </div>
                          </div>

                          {/* AI Response */}
                          {selectedLog.aiResponse && (
                            <div>
                              <h4 className="font-medium mb-2">AI Enhanced Response</h4>
                              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg space-y-2">
                                <p className="font-medium">{selectedLog.aiResponse.enhancedTitle}</p>
                                <p className="text-sm">{selectedLog.aiResponse.enhancedDescription}</p>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>Confidence: {selectedLog.aiResponse.confidence}%</div>
                                  <div>Sentiment: {selectedLog.aiResponse.sentiment}</div>
                                  <div>Priority: {selectedLog.aiResponse.priority}</div>
                                  <div>Processing: {selectedLog.aiResponse.processingTimeMs}ms</div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs font-medium">AI Reasoning:</p>
                                  <p className="text-xs">{selectedLog.aiResponse.reasoning}</p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {selectedLog.aiResponse.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Feedback Section */}
                          <div>
                            <h4 className="font-medium mb-2">Provide Feedback</h4>
                            <div className="space-y-4">
                              {/* Star Rating */}
                              <div className="space-y-2">
                                <Label>Rating (1-5 stars)</Label>
                                <div className="flex space-x-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Button
                                      key={star}
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setFeedbackRating(star)}
                                      className="p-1"
                                      data-testid={`button-rating-${star}`}
                                    >
                                      <Star
                                        className={`h-5 w-5 ${
                                          star <= feedbackRating
                                            ? 'text-yellow-500 fill-current'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    </Button>
                                  ))}
                                </div>
                              </div>

                              {/* Feedback Text */}
                              <div className="space-y-2">
                                <Label>Additional Comments (optional)</Label>
                                <Textarea
                                  value={feedbackText}
                                  onChange={(e) => setFeedbackText(e.target.value)}
                                  placeholder="Provide specific feedback about the AI enhancement..."
                                  rows={3}
                                  data-testid="textarea-feedback"
                                />
                              </div>

                              {/* Submit */}
                              <Button
                                onClick={handleSubmitFeedback}
                                disabled={feedbackRating === 0 || feedbackMutation.isPending}
                                data-testid="button-submit-feedback"
                              >
                                {feedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
                              </Button>

                              {selectedLog.userFeedback && (
                                <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                                  <p className="text-sm font-medium">Previous Feedback:</p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <div className="flex space-x-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`h-3 w-3 ${
                                            star <= (selectedLog.userFeedback || 0)
                                              ? 'text-yellow-500 fill-current'
                                              : 'text-gray-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-sm">{selectedLog.userFeedback}/5</span>
                                  </div>
                                  {selectedLog.userFeedbackText && (
                                    <p className="text-sm mt-2">{selectedLog.userFeedbackText}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {logs?.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="flex flex-col items-center space-y-4">
                <Brain className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-medium">No AI logs found</h3>
                  <p className="text-sm text-muted-foreground">
                    AI learning logs will appear here once the system processes alerts.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}