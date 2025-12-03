/**
 * Section Composer Component
 *
 * Drag-and-drop interface for customizing specification sections.
 * Users can:
 * - Enable/disable sections
 * - Reorder sections via drag-and-drop
 * - Edit section titles and descriptions
 * - Add custom sections
 * - View and edit per-section content guidance
 *
 * UPDATED: Now supports FlexibleSection system for domain-agnostic customization.
 * Uses @dnd-kit for smooth, accessible drag-and-drop experience.
 */

import React, { useState, useCallback } from 'react';
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
import type { TemplateSectionDefinition, SpecificationTemplate, FlexibleSection } from '../../types';
import { getFlexibleSections } from '../../data/templates';

interface SectionComposerProps {
  template: SpecificationTemplate;
  onCustomGuidanceChange?: (guidance: string) => void;
  /** Use flexible sections (new system) instead of legacy sections */
  useFlexibleSections?: boolean;
}

interface FlexibleSectionItemProps {
  section: FlexibleSection;
  isEnabled: boolean;
  isEditing: boolean;
  /** Position-based display order (1, 2, 3...) calculated from enabled sections */
  displayOrder: number;
  /** Whether this is a custom section (can be deleted) */
  isCustomSection?: boolean;
  onToggle: (sectionId: string, enabled: boolean) => void;
  onEdit: (sectionId: string) => void;
  onSave: (section: FlexibleSection) => void;
  onDelete: (sectionId: string) => void;
  onCancelEdit: () => void;
}

interface LegacySectionItemProps {
  section: TemplateSectionDefinition;
  isEnabled: boolean;
  /** Position-based display order (1, 2, 3...) calculated from enabled sections */
  displayOrder: number;
  onToggle: (sectionId: string, enabled: boolean) => void;
}

// Flexible section item with editing capabilities
const FlexibleSectionItem: React.FC<FlexibleSectionItemProps> = ({
  section,
  isEnabled,
  isEditing,
  displayOrder,
  isCustomSection = false,
  onToggle,
  onEdit,
  onSave,
  onDelete,
  onCancelEdit,
}) => {
  const [editedTitle, setEditedTitle] = useState(section.title);
  const [editedDescription, setEditedDescription] = useState(section.description);
  const [editedGuidance, setEditedGuidance] = useState(section.contentGuidance || '');
  const [showFullDescription, setShowFullDescription] = useState(false);

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

  const handleSave = () => {
    onSave({
      ...section,
      title: editedTitle,
      description: editedDescription,
      contentGuidance: editedGuidance || undefined,
    });
  };

  const handleCancel = () => {
    setEditedTitle(section.title);
    setEditedDescription(section.description);
    setEditedGuidance(section.contentGuidance || '');
    onCancelEdit();
  };

  // Count lines in description
  const descriptionLines = section.description.split('\n').length;
  const isLongDescription = descriptionLines > 3 || section.description.length > 200;

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <div className="border-2 border-blue-500 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="space-y-4">
            {/* Title Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Title
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Description
                <span className="font-normal text-gray-500 ml-2">(What this section should cover)</span>
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                placeholder="Describe what this section should contain...&#10;&#10;Include:&#10;- Key topics to cover&#10;- Specific requirements&#10;- Diagram placeholders ({{fig:...}})"
              />
              <p className="text-xs text-gray-500 mt-1">
                This description guides the AI when generating content for this section.
              </p>
            </div>

            {/* Content Guidance */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional Guidance
                <span className="font-normal text-gray-500 ml-2">(Optional, per-section instructions)</span>
              </label>
              <textarea
                value={editedGuidance}
                onChange={(e) => setEditedGuidance(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="E.g., 'Focus on security aspects', 'Include performance metrics table', 'Reference ISO 27001 standards'..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-gray-700 dark:text-gray-300">
                {displayOrder}
              </span>
              <h4 className="font-semibold text-gray-900 dark:text-white">
                {section.title}
              </h4>
              {isCustomSection && (
                <span
                  className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded"
                  title="Custom section added by user"
                >
                  Custom
                </span>
              )}
              {section.contentGuidance && (
                <span
                  className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded"
                  title="Has custom guidance"
                >
                  Customized
                </span>
              )}
            </div>

            {/* Section Description */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {isLongDescription && !showFullDescription ? (
                <>
                  <p className="line-clamp-2 whitespace-pre-line">{section.description}</p>
                  <button
                    onClick={() => setShowFullDescription(true)}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1"
                  >
                    Show more...
                  </button>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-line">{section.description}</p>
                  {isLongDescription && (
                    <button
                      onClick={() => setShowFullDescription(false)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-xs mt-1"
                    >
                      Show less
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Suggested Subsections */}
            {section.suggestedSubsections && section.suggestedSubsections.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {section.suggestedSubsections.map((sub, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}

            {/* Content Guidance Preview */}
            {section.contentGuidance && (
              <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                <span className="font-medium">Custom guidance:</span> {section.contentGuidance}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex items-center gap-1">
            <button
              onClick={() => onEdit(section.id)}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Edit section"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(section.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Delete section"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Legacy sortable wrapper for individual section items (backward compatibility)
const LegacySectionItem: React.FC<LegacySectionItemProps> = ({
  section,
  isEnabled,
  displayOrder,
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
                {displayOrder}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add New Section Modal
interface AddSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (section: FlexibleSection) => void;
  nextOrder: number;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ isOpen, onClose, onAdd, nextOrder }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!title.trim()) return;

    onAdd({
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Custom section',
      isRequired: false,
      order: nextOrder,
    });

    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add Custom Section
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Migration Plan"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Section Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Describe what this section should contain...&#10;&#10;Include:&#10;- Key topics to cover&#10;- Specific requirements"
              />
              <p className="text-xs text-gray-500 mt-1">
                This description guides the AI when generating content.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SectionComposer: React.FC<SectionComposerProps> = ({
  template,
  onCustomGuidanceChange,
  useFlexibleSections = true,
}) => {
  const activeTemplateConfig = useProjectStore(state => state.activeTemplateConfig);
  const toggleSection = useProjectStore(state => state.toggleSection);
  const reorderSections = useProjectStore(state => state.reorderSections);
  const updateTemplateConfig = useProjectStore(state => state.updateTemplateConfig);
  const updateSectionOverride = useProjectStore(state => state.updateSectionOverride);
  const clearAllSectionOverrides = useProjectStore(state => state.clearAllSectionOverrides);
  const addCustomSection = useProjectStore(state => state.addCustomSection);
  const updateCustomSection = useProjectStore(state => state.updateCustomSection);
  const removeCustomSection = useProjectStore(state => state.removeCustomSection);

  const [customGuidance, setCustomGuidance] = useState(activeTemplateConfig?.customGuidance || '');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get template sections
  const templateFlexibleSections = getFlexibleSections(template);

  // Merge template sections with custom sections from store
  const customSectionsFromStore = activeTemplateConfig?.customSections || [];
  const sectionOverrides = activeTemplateConfig?.sectionOverrides || {};

  // Apply section overrides to create effective sections
  const flexibleSections: FlexibleSection[] = [
    // Template sections with overrides applied
    ...templateFlexibleSections.map(section => {
      const override = sectionOverrides[section.id];
      if (override) {
        return {
          ...section,
          title: override.customTitle || section.title,
          description: override.customDescription || section.description,
        };
      }
      return section;
    }),
    // Custom sections from store
    ...customSectionsFromStore.map((cs, idx) => ({
      id: cs.id,
      title: cs.title,
      description: cs.description,
      isRequired: false,
      order: templateFlexibleSections.length + idx + 1,
    })),
  ];

  // Determine which mode to use
  const hasFlexibleSections = useFlexibleSections && (template.suggestedSections || flexibleSections.length > 0);

  // Get ordered sections based on configuration or default template order
  const orderedSectionIds = activeTemplateConfig?.sectionOrder ||
    (hasFlexibleSections
      ? flexibleSections.map(s => s.id)
      : template.sections.map(s => s.id));

  const orderedFlexibleSections = hasFlexibleSections
    ? orderedSectionIds
        .map(id => flexibleSections.find(s => s.id === id))
        .filter((s): s is FlexibleSection => s !== undefined)
    : [];

  const orderedLegacySections = !hasFlexibleSections
    ? orderedSectionIds
        .map(id => template.sections.find(s => s.id === id))
        .filter((s): s is TemplateSectionDefinition => s !== undefined)
    : [];

  // Get enabled sections
  const enabledSections = activeTemplateConfig?.enabledSections ||
    (hasFlexibleSections
      ? flexibleSections.map(s => s.id)  // All enabled by default for flexible
      : template.sections.filter(s => s.defaultEnabled).map(s => s.id));

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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

  const handleEditSection = useCallback((sectionId: string) => {
    setEditingSectionId(sectionId);
  }, []);

  const handleSaveSection = useCallback((updatedSection: FlexibleSection) => {
    const isCustom = updatedSection.id.startsWith('custom-');
    const originalTemplateSection = templateFlexibleSections.find(s => s.id === updatedSection.id);

    if (isCustom) {
      // For custom sections, update directly in the store
      updateCustomSection(updatedSection.id, {
        title: updatedSection.title,
        description: updatedSection.description,
      });
    } else if (originalTemplateSection) {
      // For template sections, save as override
      const hasChanges =
        updatedSection.title !== originalTemplateSection.title ||
        updatedSection.description !== originalTemplateSection.description;

      if (hasChanges) {
        updateSectionOverride(updatedSection.id, {
          customTitle: updatedSection.title !== originalTemplateSection.title ? updatedSection.title : undefined,
          customDescription: updatedSection.description !== originalTemplateSection.description ? updatedSection.description : undefined,
        });
      }
    }

    setEditingSectionId(null);
  }, [templateFlexibleSections, updateSectionOverride, updateCustomSection]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    const isCustom = sectionId.startsWith('custom-');

    if (!isCustom) {
      // Can't delete template sections, only disable them
      if (confirm('Template sections cannot be deleted. Would you like to disable this section instead?')) {
        toggleSection(sectionId, false);
      }
      return;
    }

    if (confirm('Are you sure you want to delete this custom section?')) {
      removeCustomSection(sectionId);
    }
  }, [toggleSection, removeCustomSection]);

  const handleAddSection = useCallback((newSection: FlexibleSection) => {
    // Add custom section to store
    addCustomSection({
      id: newSection.id,
      title: newSection.title,
      description: newSection.description,
    });
  }, [addCustomSection]);

  const enabledCount = hasFlexibleSections
    ? orderedFlexibleSections.filter(s => enabledSections.includes(s.id)).length
    : orderedLegacySections.filter(s => enabledSections.includes(s.id)).length;

  const totalCount = hasFlexibleSections ? orderedFlexibleSections.length : orderedLegacySections.length;
  const requiredCount = hasFlexibleSections ? 0 : orderedLegacySections.filter(s => s.required).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Customize Sections
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {hasFlexibleSections
              ? 'Edit, reorder, or add sections as needed'
              : 'Enable/disable sections and drag to reorder'}
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{enabledCount}</span> of {totalCount} sections enabled
          {requiredCount > 0 && (
            <span className="ml-2 text-xs">
              ({requiredCount} required)
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-900 dark:text-blue-200">
            {hasFlexibleSections ? (
              <>
                <strong>Flexible sections:</strong> Drag to reorder, click edit to customize titles and descriptions,
                or add your own sections. The descriptions tell the AI what to generate.
              </>
            ) : (
              <>
                <strong>Tip:</strong> Drag sections to reorder them. Required sections cannot be disabled.
                The AI will generate sections in the order shown below.
              </>
            )}
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
            {hasFlexibleSections ? (
              orderedFlexibleSections.map((section, index) => {
                // Calculate position-based display order (only count enabled sections)
                const enabledBefore = orderedFlexibleSections
                  .slice(0, index)
                  .filter(s => enabledSections.includes(s.id)).length;
                const displayOrder = enabledSections.includes(section.id) ? enabledBefore + 1 : index + 1;
                const isCustom = section.id.startsWith('custom-');

                return (
                  <FlexibleSectionItem
                    key={section.id}
                    section={section}
                    isEnabled={enabledSections.includes(section.id)}
                    isEditing={editingSectionId === section.id}
                    displayOrder={displayOrder}
                    isCustomSection={isCustom}
                    onToggle={handleToggle}
                    onEdit={handleEditSection}
                    onSave={handleSaveSection}
                    onDelete={handleDeleteSection}
                    onCancelEdit={() => setEditingSectionId(null)}
                  />
                );
              })
            ) : (
              orderedLegacySections.map((section, index) => {
                // Calculate position-based display order (only count enabled sections)
                const enabledBefore = orderedLegacySections
                  .slice(0, index)
                  .filter(s => enabledSections.includes(s.id)).length;
                const displayOrder = enabledSections.includes(section.id) ? enabledBefore + 1 : index + 1;

                return (
                  <LegacySectionItem
                    key={section.id}
                    section={section}
                    isEnabled={enabledSections.includes(section.id)}
                    displayOrder={displayOrder}
                    onToggle={handleToggle}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Section Button (only for flexible mode) */}
      {hasFlexibleSections && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Custom Section
        </button>
      )}

      {/* Custom Guidance */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Global Generation Guidance (Optional)
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
            const allIds = hasFlexibleSections
              ? flexibleSections.map(s => s.id)
              : template.sections.filter(s => !s.required).map(s => s.id);
            allIds.forEach(id => toggleSection(id, true));
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Enable All
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={() => {
            const optionalIds = hasFlexibleSections
              ? flexibleSections.map(s => s.id)
              : template.sections.filter(s => !s.required).map(s => s.id);
            optionalIds.forEach(id => toggleSection(id, false));
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Disable All
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={() => {
            const defaultOrder = hasFlexibleSections
              ? flexibleSections.sort((a, b) => a.order - b.order).map(s => s.id)
              : template.sections.map(s => s.id);
            reorderSections(defaultOrder);
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Reset Order
        </button>
        {hasFlexibleSections && (
          <>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={() => {
                if (confirm('Reset all sections to template defaults? This will remove all custom sections and restore original titles/descriptions.')) {
                  // Clear all section overrides
                  clearAllSectionOverrides();
                  // Remove all custom sections
                  customSectionsFromStore.forEach(cs => removeCustomSection(cs.id));
                  // Reset to default template sections
                  const defaultIds = templateFlexibleSections.map(s => s.id);
                  updateTemplateConfig({
                    enabledSections: defaultIds,
                    sectionOrder: defaultIds,
                    customSections: [],
                  });
                }
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Reset All
            </button>
          </>
        )}
      </div>

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddSection}
        nextOrder={flexibleSections.length + 1}
      />
    </div>
  );
};
