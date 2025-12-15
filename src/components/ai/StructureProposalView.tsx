/**
 * Structure Proposal View
 *
 * Displays the AI-proposed document structure with drag-drop reordering,
 * inline editing, and section management capabilities.
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
} from '@dnd-kit/sortable';
import SectionCard from './SectionCard';
import type { ProposedStructure, ProposedSection } from '../../types';

interface StructureProposalViewProps {
  structure: ProposedStructure;
  onStructureChange: (structure: ProposedStructure) => void;
}

export default function StructureProposalView({
  structure,
  onStructureChange,
}: StructureProposalViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // DnD Kit sensors
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

  // Sort sections by order
  const sortedSections = [...structure.sections].sort((a, b) => a.order - b.order);
  const sectionIds = sortedSections.map((s) => s.id);

  /**
   * Handle drag end - reorder sections
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = sectionIds.indexOf(active.id as string);
        const newIndex = sectionIds.indexOf(over.id as string);

        const newOrder = arrayMove(sortedSections, oldIndex, newIndex);

        // Update order numbers
        const reorderedSections = newOrder.map((section, idx) => ({
          ...section,
          order: idx + 1,
        }));

        onStructureChange({
          ...structure,
          sections: reorderedSections,
          version: structure.version + 1,
          lastModifiedAt: new Date(),
        });
      }
    },
    [structure, sortedSections, sectionIds, onStructureChange]
  );

  /**
   * Toggle section expansion
   */
  const toggleExpanded = useCallback((sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  /**
   * Update a section
   */
  const handleSectionUpdate = useCallback(
    (sectionId: string, updates: Partial<ProposedSection>) => {
      const updatedSections = structure.sections.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      );

      onStructureChange({
        ...structure,
        sections: updatedSections,
        version: structure.version + 1,
        lastModifiedAt: new Date(),
      });

      setEditingSection(null);
    },
    [structure, onStructureChange]
  );

  /**
   * Delete a section
   */
  const handleSectionDelete = useCallback(
    (sectionId: string) => {
      const updatedSections = structure.sections
        .filter((s) => s.id !== sectionId)
        .map((section, idx) => ({
          ...section,
          order: idx + 1,
        }));

      onStructureChange({
        ...structure,
        sections: updatedSections,
        version: structure.version + 1,
        lastModifiedAt: new Date(),
      });
    },
    [structure, onStructureChange]
  );

  /**
   * Add a new section
   */
  const handleAddSection = useCallback(() => {
    const newSection: ProposedSection = {
      id: `custom-${Date.now()}`,
      title: 'New Section',
      description: 'Describe what this section should contain.',
      rationale: 'Added by user',
      order: structure.sections.length + 1,
      confidence: 1.0,
    };

    onStructureChange({
      ...structure,
      sections: [...structure.sections, newSection],
      version: structure.version + 1,
      lastModifiedAt: new Date(),
    });

    // Auto-expand and edit the new section
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
    setEditingSection(newSection.id);
  }, [structure, onStructureChange]);

  /**
   * Expand/collapse all sections
   */
  const handleExpandAll = useCallback(() => {
    setExpandedSections(new Set(structure.sections.map((s) => s.id)));
  }, [structure.sections]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            title="Expand all"
          >
            Expand All
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={handleCollapseAll}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            title="Collapse all"
          >
            Collapse All
          </button>
        </div>
        <button
          onClick={handleAddSection}
          className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Section
        </button>
      </div>

      {/* Structure Rationale */}
      {structure.rationale && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>AI Rationale:</strong> {structure.rationale}
          </p>
        </div>
      )}

      {/* Sections List with DnD */}
      <div className="flex-1 overflow-y-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sortedSections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  isEditing={editingSection === section.id}
                  onToggleExpand={() => toggleExpanded(section.id)}
                  onStartEdit={() => setEditingSection(section.id)}
                  onCancelEdit={() => setEditingSection(null)}
                  onUpdate={(updates) => handleSectionUpdate(section.id, updates)}
                  onDelete={() => handleSectionDelete(section.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Empty State */}
        {sortedSections.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <svg
              className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>No sections in structure</p>
            <button
              onClick={handleAddSection}
              className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Add your first section
            </button>
          </div>
        )}
      </div>

      {/* Format Guidance */}
      {structure.formatGuidance && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Format Guidance
            </summary>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{structure.formatGuidance}</p>
          </details>
        </div>
      )}
    </div>
  );
}
