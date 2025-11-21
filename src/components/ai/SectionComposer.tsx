/**
 * Section Composer Component
 *
 * Drag-and-drop interface for customizing specification sections.
 * Users can enable/disable sections and reorder them before generation.
 * Uses @dnd-kit for smooth, accessible drag-and-drop experience.
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProjectStore } from '../../store/projectStore';
import type { TemplateSectionDefinition, SpecificationTemplate } from '../../types';

interface SectionComposerProps {
  template: SpecificationTemplate;
  onCustomGuidanceChange?: (guidance: string) => void;
}

interface SortableSectionItemProps {
  section: TemplateSectionDefinition;
  isEnabled: boolean;
  onToggle: (sectionId: string, enabled: boolean) => void;
}

// Sortable wrapper for individual section items
const SortableSectionItem: React.FC<SortableSectionItemProps> = ({
  section,
  isEnabled,
  onToggle,
}) => {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`
          border rounded-lg p-4 bg-white dark:bg-gray-800
          transition-all
          ${isDragging ? 'shadow-lg border-blue-500' : 'border-gray-200 dark:border-gray-700'}
          ${!isEnabled ? 'opacity-60' : ''}
        `}
      >
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
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
    </div>
  );
};

export const SectionComposer: React.FC<SectionComposerProps> = ({
  template,
  onCustomGuidanceChange,
}) => {
  const activeTemplateConfig = useProjectStore(state => state.activeTemplateConfig);
  const toggleSection = useProjectStore(state => state.toggleSection);
  const reorderSections = useProjectStore(state => state.reorderSections);
  const updateTemplateConfig = useProjectStore(state => state.updateTemplateConfig);

  const [customGuidance, setCustomGuidance] = useState(activeTemplateConfig?.customGuidance || '');

  // Get ordered sections based on configuration or default template order
  const orderedSectionIds = activeTemplateConfig?.sectionOrder || template.sections.map(s => s.id);
  const orderedSections = orderedSectionIds
    .map(id => template.sections.find(s => s.id === id))
    .filter((s): s is TemplateSectionDefinition => s !== undefined);

  // Get enabled sections
  const enabledSections = activeTemplateConfig?.enabledSections || template.sections.filter(s => s.defaultEnabled).map(s => s.id);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedSectionIds.indexOf(active.id as string);
      const newIndex = orderedSectionIds.indexOf(over.id as string);
      const newOrder = arrayMove(orderedSectionIds, oldIndex, newIndex);
      reorderSections(newOrder);
    }
  };

  const handleToggle = (sectionId: string, enabled: boolean) => {
    toggleSection(sectionId, enabled);
  };

  const handleCustomGuidanceChange = (value: string) => {
    setCustomGuidance(value);
    updateTemplateConfig({ customGuidance: value });
    onCustomGuidanceChange?.(value);
  };

  const enabledCount = orderedSections.filter(s => enabledSections.includes(s.id)).length;
  const requiredCount = orderedSections.filter(s => s.required).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Customize Sections
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enable/disable sections and drag to reorder
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{enabledCount}</span> of {orderedSections.length} sections enabled
          <span className="ml-2 text-xs">
            ({requiredCount} required)
          </span>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Tip:</strong> Drag sections to reorder them. Required sections cannot be disabled.
            The AI will generate sections in the order shown below.
          </div>
        </div>
      </div>

      {/* Sections List with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedSectionIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {orderedSections.map((section) => (
              <SortableSectionItem
                key={section.id}
                section={section}
                isEnabled={enabledSections.includes(section.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Custom Guidance */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Custom Generation Guidance (Optional)
        </label>
        <textarea
          value={customGuidance}
          onChange={(e) => handleCustomGuidanceChange(e.target.value)}
          placeholder="Provide additional instructions for the AI when generating this specification (e.g., 'Focus on 5G-SA deployment', 'Use vendor-specific terminology', 'Emphasize security aspects')..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          This guidance will be passed to the AI for all sections to ensure consistency.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={() => {
            template.sections.forEach(s => {
              if (!s.required) toggleSection(s.id, true);
            });
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Enable All
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={() => {
            template.sections.forEach(s => {
              if (!s.required) toggleSection(s.id, false);
            });
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Disable All Optional
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={() => {
            const defaultOrder = template.sections.map(s => s.id);
            reorderSections(defaultOrder);
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Reset Order
        </button>
      </div>
    </div>
  );
};
