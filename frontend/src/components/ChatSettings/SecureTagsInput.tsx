/**
 * Enhanced TagsInput with Security Features
 * ========================================
 *
 * Extends the existing TagsInput component to support:
 * - Automatic masking of sensitive values
 * - Validation with security patterns
 * - Reveal/hide controls for masked values
 * - Visual security indicators
 */
import { Eye, EyeOff, Lock } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { IInput } from 'types/Input';

import { InputStateHandler } from './InputStateHandler';

export type SecureTagsInputProps = {
  placeholder?: string;
  value?: string[];
  setField?(field: string, value: string[], shouldValidate?: boolean): void;
} & IInput &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'color'>;

export const SecureTagsInput = ({
  description,
  hasError,
  id,
  label,
  tooltip,
  value = [],
  setField,
  placeholder,
  ...rest
}: SecureTagsInputProps): JSX.Element => {
  const [inputValue, setInputValue] = useState('');
  const [revealedTags, setRevealedTags] = useState<Set<string>>(new Set());
  const [showAllSensitive, setShowAllSensitive] = useState(false);

  // Auto-detect sensitive values using patterns
  const detectSensitiveValue = useCallback((tag: string): boolean => {
    const sensitivePatterns = [
      /.*key.*=.*/i, // Anything with "key="
      /.*token.*=.*/i, // Anything with "token="
      /.*secret.*=.*/i, // Anything with "secret="
      /.*password.*=.*/i, // Anything with "password="
      /.*api.*=.*/i, // Anything with "api="
      /.*auth.*=.*/i, // Anything with "auth="
      /.*bearer.*=.*/i, // Anything with "bearer="
      /.*credential.*=.*/i // Anything with "credential="
    ];

    return sensitivePatterns.some((pattern) => pattern.test(tag));
  }, []);

  // Mask sensitive values for display
  const getMaskedValue = useCallback(
    (tag: string, isRevealed: boolean = false): string => {
      if (!detectSensitiveValue(tag)) {
        return tag;
      }

      if (isRevealed || showAllSensitive) {
        return tag;
      }

      if (tag.includes('=')) {
        const [key, value] = tag.split('=', 2);
        const maskedValue = maskString(value);
        return `${key}=${maskedValue}`;
      } else {
        return maskString(tag);
      }
    },
    [detectSensitiveValue, showAllSensitive]
  );

  // Apply masking to string - show first 4 and last 4 chars
  const maskString = (value: string): string => {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }

    const startChars = value.substring(0, 4);
    const endChars = value.substring(value.length - 4);
    const middleLength = value.length - 8;
    const middleMask = '*'.repeat(Math.max(4, middleLength));

    return `${startChars}${middleMask}${endChars}`;
  };

  // Handle adding new tag
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();

      const newTag = inputValue.trim();
      if (!value.includes(newTag)) {
        const newTags = [...value, newTag];
        setField?.(id, newTags, false);
      }
      setInputValue('');
    }
  };

  // Toggle reveal for specific tag
  const toggleTagReveal = (tag: string) => {
    setRevealedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    const newTags = value.filter((tag) => tag !== tagToRemove);
    setField?.(id, newTags, false);
    setRevealedTags((prev) => {
      const newSet = new Set(prev);
      newSet.delete(tagToRemove);
      return newSet;
    });
  };

  // Check if any tags are sensitive
  const hasSensitiveTags = value.some((tag) => detectSensitiveValue(tag));

  return (
    <TooltipProvider>
      <InputStateHandler
        description={description}
        hasError={hasError}
        id={id}
        label={label}
        tooltip={tooltip}
      >
        <div className="space-y-3">
          {/* Security controls */}
          {hasSensitiveTags && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Contains sensitive data</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllSensitive(!showAllSensitive)}
                className="ml-auto"
              >
                {showAllSensitive ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {showAllSensitive ? 'Hide All' : 'Reveal All'}
              </Button>
            </div>
          )}

          {/* Tags display */}
          <div className="flex flex-wrap gap-2">
            {value.map((tag) => {
              const isRevealed = revealedTags.has(tag);
              const isSensitive = detectSensitiveValue(tag);

              return (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  {/* Security indicator icon */}
                  {isSensitive && <Lock className="h-3 w-3 text-orange-500" />}

                  {/* Tag value (masked or revealed) */}
                  <span className="font-mono text-xs">
                    {getMaskedValue(tag, isRevealed)}
                  </span>

                  {/* Reveal/hide button for sensitive tags */}
                  {isSensitive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => toggleTagReveal(tag)}
                        >
                          {isRevealed || showAllSensitive ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isRevealed || showAllSensitive
                          ? 'Hide value'
                          : 'Reveal value'}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => removeTag(tag)}
                  >
                    ×
                  </Button>
                </Badge>
              );
            })}
          </div>

          {/* Input field */}
          <Input
            {...rest}
            id={id}
            name={id}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Enter value and press Enter...'}
            className="mt-1"
          />
        </div>
      </InputStateHandler>
    </TooltipProvider>
  );
};
