import { useState, useEffect, useRef } from 'react';
import { generateFigureSuggestions, generateReferenceSuggestions } from '../utils/linkResolver';
import type { FigureReference, CitationReference } from '../utils/linkResolver';

export interface AutocompleteProps {
  textarea: HTMLTextAreaElement;
  figures: FigureReference[];
  citations: CitationReference[];
  onInsert: (text: string) => void;
}

export function LinkAutocomplete({ textarea, figures, citations, onInsert }: AutocompleteProps) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'figure' | 'reference' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleInput = () => {
      const cursorPos = textarea.selectionStart;
      const text = textarea.value;
      const before = text.substring(0, cursorPos);

      // Check for {{fig: or {{ref: trigger
      const figMatch = before.match(/\{\{fig:([a-zA-Z0-9-_]*)$/);
      const refMatch = before.match(/\{\{ref:([a-zA-Z0-9-_]*)$/);

      if (figMatch) {
        setType('figure');
        setQuery(figMatch[1]);
        setShow(true);
        setSelectedIndex(0);
        updatePosition();
      } else if (refMatch) {
        setType('reference');
        setQuery(refMatch[1]);
        setShow(true);
        setSelectedIndex(0);
        updatePosition();
      } else {
        setShow(false);
        setType(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!show) return;

      const suggestions = getSuggestions();

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault();
          insertSuggestion(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShow(false);
      }
    };

    const updatePosition = () => {
      const rect = textarea.getBoundingClientRect();
      const cursorPos = textarea.selectionStart;
      const text = textarea.value.substring(0, cursorPos);
      const lines = text.split('\n');
      const currentLine = lines.length - 1;
      const currentCol = lines[lines.length - 1].length;

      // Rough estimate of cursor position (this is simplified)
      const charWidth = 8; // Approximate
      const lineHeight = 20; // Approximate

      setPosition({
        top: rect.top + (currentLine * lineHeight) + lineHeight + textarea.scrollTop,
        left: rect.left + (currentCol * charWidth),
      });
    };

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  }, [textarea, show, selectedIndex, figures, citations]);

  const getSuggestions = () => {
    if (type === 'figure') {
      return generateFigureSuggestions(figures, query);
    } else if (type === 'reference') {
      return generateReferenceSuggestions(citations, query);
    }
    return [];
  };

  const insertSuggestion = (suggestion: { id: string; label: string; description: string }) => {
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);

    // Remove the incomplete {{fig: or {{ref: trigger
    const beforeCleaned = type === 'figure'
      ? before.replace(/\{\{fig:[a-zA-Z0-9-_]*$/, '')
      : before.replace(/\{\{ref:[a-zA-Z0-9-_]*$/, '');

    const newText = beforeCleaned + suggestion.label + after;
    onInsert(newText);

    setShow(false);

    // Move cursor after inserted text
    setTimeout(() => {
      const newCursorPos = beforeCleaned.length + suggestion.label.length;
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
      textarea.focus();
    }, 0);
  };

  if (!show) return null;

  const suggestions = getSuggestions();

  if (suggestions.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '300px',
      }}
    >
      <div className="py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            className={`w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 ${
              index === selectedIndex ? 'bg-blue-100 dark:bg-gray-700' : ''
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => insertSuggestion(suggestion)}
          >
            <div className="font-mono text-sm text-blue-600 dark:text-blue-400">
              {suggestion.label}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {suggestion.description}
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-500 dark:text-gray-400">
        ↑↓ navigate • Enter/Tab insert • Esc close
      </div>
    </div>
  );
}
