/**
 * Section Card
 *
 * Individual section card for the Structure Proposal View.
 * Supports drag-drop, inline editing, and expansion.
 */

import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProposedSection } from '../../types';

interface SectionCardProps {
  section: ProposedSection;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (updates: Partial<ProposedSection>) => void;
  onDelete: () => void;
}

export default function SectionCard({
  section,
  isExpanded,
  isEditing,
  onToggleExpand,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: SectionCardProps) {
  // Editing state
  const [editTitle, setEditTitle] = useState(section.title);
  const [editDescription, setEditDescription] = useState(section.description);
  const [editSubsections, setEditSubsections] = useState(
    section.suggestedSubsections?.join(', ') || ''
  );
  const [editContentGuidance, setEditContentGuidance] = useState(
    section.contentGuidance || ''
  );

  // DnD Kit sortable
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Reset edit state when section changes
  useEffect(() => {
    setEditTitle(section.title);
    setEditDescription(section.description);
    setEditSubsections(section.suggestedSubsections?.join(', ') || '');
    setEditContentGuidance(section.contentGuidance || '');
  }, [section]);

  /**
   * Handle save
   */
  const handleSave = () => {
    onUpdate({
      title: editTitle,
      description: editDescription,
      suggestedSubsections: editSubsections
        ? editSubsections.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      contentGuidance: editContentGuidance.trim() || undefined,
    });
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setEditTitle(section.title);
    setEditDescription(section.description);
    setEditSubsections(section.suggestedSubsections?.join(', ') || '');
    setEditContentGuidance(section.contentGuidance || '');
    onCancelEdit();
  };

  /**
   * Get confidence color
   */
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg bg-white dark:bg-gray-800 ${
        isDragging
          ? 'shadow-lg ring-2 ring-blue-500 opacity-90'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
          title="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {/* Section Number */}
        <span className="w-6 h-6 flex items-center justify-center text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded">
          {section.order}
        </span>

        {/* Title */}
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 px-2 py-1 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            autoFocus
          />
        ) : (
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left font-medium text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
          >
            {section.title}
          </button>
        )}

        {/* Confidence Badge */}
        {!isEditing && section.confidence !== undefined && (
          <span
            className={`text-xs ${getConfidenceColor(section.confidence)}`}
            title={`AI confidence: ${Math.round(section.confidence * 100)}%`}
          >
            {Math.round(section.confidence * 100)}%
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                title="Save"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={handleCancel}
                className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                title="Cancel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onStartEdit}
                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                title="Edit section"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                title="Delete section"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={onToggleExpand}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {(isExpanded || isEditing) && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
          {/* Description */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Description
            </label>
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-300">{section.description}</p>
            )}
          </div>

          {/* Suggested Subsections */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Suggested Subsections
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editSubsections}
                onChange={(e) => setEditSubsections(e.target.value)}
                placeholder="Subsection 1, Subsection 2, ..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            ) : section.suggestedSubsections && section.suggestedSubsections.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {section.suggestedSubsections.map((sub, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-700 dark:text-gray-300"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">None specified</p>
            )}
          </div>

          {/* Content Guidance - Specific Requirements */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Specific Requirements
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editContentGuidance}
                onChange={(e) => setEditContentGuidance(e.target.value)}
                placeholder="Keep brief, focus on X..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            ) : section.contentGuidance ? (
              <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                {section.contentGuidance}
              </p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">None specified</p>
            )}
          </div>

          {/* Include Diagrams Toggle */}
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={section.includeDiagrams !== false}
                onChange={(e) => onUpdate({ includeDiagrams: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Include diagram placeholders
              </span>
              {section.includeDiagrams === false && (
                <span className="text-xs text-orange-600 dark:text-orange-400">(disabled)</span>
              )}
            </label>
          </div>

          {/* Rationale (read-only) */}
          {!isEditing && section.rationale && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                AI Rationale
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">{section.rationale}</p>
            </div>
          )}

          {/* Source Hints (read-only) */}
          {!isEditing && section.sourceHints && section.sourceHints.length > 0 && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Source Hints
              </label>
              <div className="flex flex-wrap gap-1">
                {section.sourceHints.map((hint, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded dark:bg-blue-900/20 dark:text-blue-400"
                  >
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Requirement Numbering Toggle */}
          <div className="mt-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={section.enableRequirementNumbering !== false}
                onChange={(e) => onUpdate({ enableRequirementNumbering: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Add requirement IDs to normative statements
              </span>
              {section.enableRequirementNumbering === false && (
                <span className="text-xs text-orange-600 dark:text-orange-400">(disabled)</span>
              )}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
