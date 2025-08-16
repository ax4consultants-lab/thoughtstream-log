import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  suggestions?: string[];
}

export function TagInput({ 
  tags, 
  onTagsChange, 
  placeholder = "Add a tag...", 
  disabled,
  suggestions = ['Personal', 'Work', 'Family', 'Health', 'Travel', 'Ideas'] 
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      onTagsChange([...tags, trimmedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  }, [tags, onTagsChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  }, [tags, onTagsChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = suggestions.filter(
    suggestion => 
      !tags.includes(suggestion) && 
      suggestion.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-3 bg-card border rounded-xl focus-within:ring-2 focus-within:ring-ring">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="px-3 py-1 text-sm bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
          >
            {tag}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => removeTag(tag)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </Badge>
        ))}
        
        {!disabled && (
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={tags.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] border-none bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        )}
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="bg-popover border rounded-xl shadow-medium p-2 space-y-1">
          <div className="text-xs text-muted-foreground px-2 py-1">Quick tags</div>
          <div className="flex flex-wrap gap-1">
            {filteredSuggestions.slice(0, 6).map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-xs rounded-lg",
                  "hover:bg-primary/10 hover:text-primary"
                )}
                onClick={() => addTag(suggestion)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}