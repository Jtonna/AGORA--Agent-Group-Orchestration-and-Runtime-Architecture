import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  defaultHint?: string;
  isActive: boolean;
  onNavigateNext: () => void;
  onNavigatePrev?: () => void;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  defaultHint,
  isActive,
  onNavigateNext,
  onNavigatePrev,
}: AutocompleteInputProps) {
  // Track if we just completed an autocomplete (to force cursor to end)
  const [pendingComplete, setPendingComplete] = useState<string | null>(null);

  // After autocomplete, briefly clear then re-set to force cursor to end
  useEffect(() => {
    if (pendingComplete !== null) {
      // Clear first, then set the completed value
      onChange('');
      const timer = setTimeout(() => {
        onChange(pendingComplete);
        setPendingComplete(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pendingComplete, onChange]);

  // Find the best matching suggestion based on current value
  const suggestion = useMemo(() => {
    if (!value) return null;
    const lowerValue = value.toLowerCase();
    const match = suggestions.find(s =>
      s.toLowerCase().startsWith(lowerValue) && s.toLowerCase() !== lowerValue
    );
    return match || null;
  }, [value, suggestions]);

  // The remaining part of the suggestion to show in gray
  const suggestionSuffix = suggestion ? suggestion.slice(value.length) : '';

  useInput((input, key) => {
    if (!isActive) return;

    if (key.tab) {
      if (suggestion) {
        // Complete the suggestion - use pendingComplete to force cursor to end
        setPendingComplete(suggestion);
      } else {
        // No suggestion to complete, navigate to next field
        onNavigateNext();
      }
      return;
    }

    if (key.upArrow && onNavigatePrev) {
      onNavigatePrev();
      return;
    }

    if (key.downArrow) {
      onNavigateNext();
      return;
    }
  }, { isActive });

  // When not active, just show the value or placeholder
  if (!isActive) {
    if (value) {
      return <Text>{value}</Text>;
    }
    if (defaultHint) {
      return <Text dimColor>{defaultHint}</Text>;
    }
    return <Text dimColor>{placeholder || '(empty)'}</Text>;
  }

  // Active state: show input with suggestion
  return (
    <Box>
      <TextInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {suggestionSuffix && (
        <Text dimColor>{suggestionSuffix}</Text>
      )}
      {!value && !suggestionSuffix && defaultHint && (
        <Text dimColor> {defaultHint}</Text>
      )}
    </Box>
  );
}
