/**
 * Section Item Component
 *
 * Individual draggable section item for the SectionComposer.
 * Shows section number, title, description, and enable/disable checkbox.
 */

import React from 'react';
import type { TemplateSectionDefinition } from '../../types';

interface SectionItemProps {
  section: TemplateSectionDefinition;
  isEnabled: boolean;
  onToggle: (sectionId: string, enabled: boolean) => void;
  isDragging?: boolean;
}

export const SectionItem: React.FC<SectionItemProps> = ({
  section,
  isEnabled,
  onToggle,
  isDragging = false,
}) => {
  return (
    <div
      className={`
        border rounded-lg p-4 bg-white dark:bg-gray-800
        transition-all
        ${isDragging ? 'opacity-50 border-blue-500' : 'border-gray-200 dark:border-gray-700'}
        ${!isEnabled ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Checkbox */}
        <div className="flex-shrink-0 mt-1">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => onToggle(section.id, e.target.checked)}
            disabled={section.required}
            className={`
              w-5 h-5 rounded border-gray-300 dark:border-gray-600
              text-blue-600 focus:ring-blue-500
              ${section.required ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            `}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
              {section.number}
            </span>
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
              {section.title}
            </h4>
            {section.required && (
              <span
                className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-0.5 rounded"
                title="This section is required and cannot be disabled"
              >
                Required
              </span>
            )}
          </div>

          {/* Section Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {section.description}
          </p>

          {/* Section Metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-500">
            {section.allowSubsections && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Allows subsections
              </span>
            )}
            <span className="flex items-center gap-1 font-mono" title="Prompt key">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {section.promptKey}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
