/**
 * Template Selection Modal
 *
 * Allows users to choose a specification template when creating a new document.
 * Shows available templates with descriptions, domains, and section counts.
 */

import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { SpecificationTemplate } from '../../types';

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const availableTemplates = useProjectStore(state => state.availableTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>('all');

  if (!isOpen) return null;

  // Get unique domains for filtering
  const domains = ['all', ...new Set(availableTemplates.map(t => t.domain))];

  // Filter templates by domain
  const filteredTemplates = filterDomain === 'all'
    ? availableTemplates
    : availableTemplates.filter(t => t.domain === filterDomain);

  // Get selected template details
  const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);

  const handleSelect = () => {
    if (selectedTemplateId) {
      onSelect(selectedTemplateId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Select Specification Template
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Choose a template that best fits your document requirements
          </p>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">
            Filter by Domain:
          </label>
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {domains.map(domain => (
              <option key={domain} value={domain}>
                {domain === 'all' ? 'All Domains' : domain.charAt(0).toUpperCase() + domain.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No templates available. Templates will be loaded when the application starts.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`
                    border-2 rounded-lg p-4 cursor-pointer transition-all
                    ${selectedTemplateId === template.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      {template.name}
                    </h3>
                    {template.isBuiltIn && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                        Built-in
                      </span>
                    )}
                  </div>

                  {/* Template Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {template.description}
                  </p>

                  {/* Template Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      {template.domain}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {template.sections.length} sections
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      v{template.version}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Template Details */}
        {selectedTemplate && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Template Sections ({selectedTemplate.sections.length}):
            </h4>
            <div className="max-h-32 overflow-y-auto">
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {selectedTemplate.sections.map((section) => (
                  <li key={section.id} className="flex items-center gap-2">
                    <span className="font-mono text-gray-500 dark:text-gray-500">
                      {section.number}
                    </span>
                    <span>{section.title}</span>
                    {section.required && (
                      <span className="text-red-600 dark:text-red-400">*</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!selectedTemplateId}
            className={`
              px-4 py-2 text-sm font-medium rounded transition-colors
              ${selectedTemplateId
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Select Template
          </button>
        </div>
      </div>
    </div>
  );
};
