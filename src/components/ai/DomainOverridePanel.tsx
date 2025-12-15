/**
 * Domain Override Panel
 *
 * Allows users to view AI-inferred domain settings and optionally override them.
 */

import React, { useState, useCallback } from 'react';
import type { DomainInference, DomainConfig } from '../../types';

interface DomainOverridePanelProps {
  inferredDomain: DomainInference;
  currentOverride: DomainConfig | null;
  onOverride: (config: DomainConfig | null) => void;
}

const NORMATIVE_LANGUAGE_OPTIONS: Array<{
  value: DomainConfig['normativeLanguage'];
  label: string;
  example: string;
}> = [
  { value: 'RFC2119', label: 'RFC 2119', example: 'SHALL, SHOULD, MAY' },
  { value: 'IEEE', label: 'IEEE', example: 'shall, should, may' },
  { value: 'ISO', label: 'ISO', example: 'shall, should, may' },
  { value: 'custom', label: 'Custom', example: 'Define your own terms' },
];

const COMMON_DOMAINS = [
  'telecommunications',
  'software',
  'aerospace',
  'automotive',
  'medical',
  'financial',
  'manufacturing',
  'cybersecurity',
];

export default function DomainOverridePanel({
  inferredDomain,
  currentOverride,
  onOverride,
}: DomainOverridePanelProps) {
  // Local state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editDomain, setEditDomain] = useState(currentOverride?.domain || inferredDomain.domain);
  const [editIndustry, setEditIndustry] = useState(
    currentOverride?.industry || inferredDomain.industry
  );
  const [editStandards, setEditStandards] = useState(
    (currentOverride?.standards || inferredDomain.detectedStandards).join(', ')
  );
  const [editNormativeLanguage, setEditNormativeLanguage] = useState<
    DomainConfig['normativeLanguage']
  >(currentOverride?.normativeLanguage || 'RFC2119');

  /**
   * Handle save override
   */
  const handleSave = useCallback(() => {
    const config: DomainConfig = {
      domain: editDomain,
      industry: editIndustry || undefined,
      standards: editStandards
        ? editStandards.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      normativeLanguage: editNormativeLanguage,
    };

    onOverride(config);
    setIsEditing(false);
  }, [editDomain, editIndustry, editStandards, editNormativeLanguage, onOverride]);

  /**
   * Handle reset to inferred
   */
  const handleReset = useCallback(() => {
    setEditDomain(inferredDomain.domain);
    setEditIndustry(inferredDomain.industry);
    setEditStandards(inferredDomain.detectedStandards.join(', '));
    setEditNormativeLanguage('RFC2119');
    onOverride(null);
    setIsEditing(false);
  }, [inferredDomain, onOverride]);

  /**
   * Get the effective domain config
   */
  const effectiveConfig = currentOverride || {
    domain: inferredDomain.domain,
    industry: inferredDomain.industry,
    standards: inferredDomain.detectedStandards,
    terminology: inferredDomain.suggestedTerminology,
    normativeLanguage: 'RFC2119' as const,
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-medium text-gray-700 dark:text-gray-300">Domain Settings</span>
          {currentOverride && (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded dark:bg-yellow-900/30 dark:text-yellow-400">
              Overridden
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentOverride && !isEditing && (
            <button
              onClick={handleReset}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Reset to Inferred
            </button>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-4">
            {/* Domain */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Domain
              </label>
              <div className="flex gap-2">
                <select
                  value={COMMON_DOMAINS.includes(editDomain) ? editDomain : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setEditDomain(e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {COMMON_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
                {!COMMON_DOMAINS.includes(editDomain) && (
                  <input
                    type="text"
                    value={editDomain}
                    onChange={(e) => setEditDomain(e.target.value)}
                    placeholder="Custom domain"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                )}
              </div>
            </div>

            {/* Industry */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Industry (specific)
              </label>
              <input
                type="text"
                value={editIndustry}
                onChange={(e) => setEditIndustry(e.target.value)}
                placeholder="e.g., 5G mobile networks"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Standards */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Applicable Standards (comma-separated)
              </label>
              <input
                type="text"
                value={editStandards}
                onChange={(e) => setEditStandards(e.target.value)}
                placeholder="e.g., 3GPP TS 23.501, RFC 8200"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Normative Language */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Normative Language Style
              </label>
              <div className="space-y-2">
                {NORMATIVE_LANGUAGE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="normativeLanguage"
                      value={option.value}
                      checked={editNormativeLanguage === option.value}
                      onChange={() => setEditNormativeLanguage(option.value)}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {option.label}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ({option.example})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Save Override
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Domain */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Domain</span>
              <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                {effectiveConfig.domain}
              </p>
            </div>

            {/* Industry */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Industry</span>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {effectiveConfig.industry || 'Not specified'}
              </p>
            </div>

            {/* AI Confidence */}
            {!currentOverride && (
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">AI Confidence</span>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(inferredDomain.confidence * 100)}%
                </p>
              </div>
            )}

            {/* Normative Language */}
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Normative Language</span>
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {effectiveConfig.normativeLanguage || 'RFC2119'}
              </p>
            </div>

            {/* Standards */}
            {effectiveConfig.standards && effectiveConfig.standards.length > 0 && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Applicable Standards</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {effectiveConfig.standards.map((std, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {std}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Reasoning (only when using inferred) */}
            {!currentOverride && inferredDomain.reasoning && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">AI Reasoning</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">
                  {inferredDomain.reasoning}
                </p>
              </div>
            )}

            {/* Key Terminology */}
            {effectiveConfig.terminology && Object.keys(effectiveConfig.terminology).length > 0 && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Key Terminology</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(effectiveConfig.terminology).slice(0, 5).map(([abbr, full]) => (
                    <span
                      key={abbr}
                      className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-700 dark:text-gray-300"
                      title={full}
                    >
                      {abbr}
                    </span>
                  ))}
                  {Object.keys(effectiveConfig.terminology).length > 5 && (
                    <span className="px-2 py-0.5 text-xs text-gray-400">
                      +{Object.keys(effectiveConfig.terminology).length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
