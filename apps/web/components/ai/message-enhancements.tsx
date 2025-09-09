/**
 * Message Enhancements Component
 * Displays AI suggestions, action items, and related topics
 */

'use client';

import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { Card } from '@kit/ui/card';
import { 
  Lightbulb, 
  CheckSquare, 
  ArrowRight, 
  Sparkles 
} from 'lucide-react';

interface MessageEnhancementsProps {
  suggestions?: string[];
  actionItems?: string[];
  relatedTopics?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  onTopicClick?: (topic: string) => void;
}

export function MessageEnhancements({
  suggestions = [],
  actionItems = [],
  relatedTopics = [],
  onSuggestionClick,
  onTopicClick,
}: MessageEnhancementsProps) {
  
  if (!suggestions.length && !actionItems.length && !relatedTopics.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Sugerencias
            </span>
          </div>
          <div className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-auto p-2 text-xs text-left justify-start w-full"
                onClick={() => onSuggestionClick?.(suggestion)}
              >
                <ArrowRight className="h-3 w-3 mr-2 flex-shrink-0" />
                <span className="truncate">{suggestion}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Acciones Recomendadas
            </span>
          </div>
          <div className="space-y-1">
            {actionItems.map((action, index) => (
              <div
                key={index}
                className="text-xs text-muted-foreground bg-muted/50 rounded p-2 border-l-2 border-green-500"
              >
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Topics */}
      {relatedTopics.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">
              Temas Relacionados
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {relatedTopics.map((topic, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-secondary/80"
                onClick={() => onTopicClick?.(topic)}
              >
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}