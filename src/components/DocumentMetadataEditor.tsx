/**
 * Document Metadata Editor
 *
 * Panel for editing document metadata used in the front matter of exported DOCX:
 * cover page info, document release entries, customer sign-off, revision history,
 * and logo assignment from extracted template images.
 */

import { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { DocumentReleaseEntry, Approver, Revision } from '../types';

export interface LogoCandidate {
  filename: string;
  mimeType: string;
  dataUrl: string; // For thumbnail preview
  size: number;
}

interface DocumentMetadataEditorProps {
  logoCandidates: LogoCandidate[];
  onLogoAssigned: (role: 'vendor' | 'customer', candidate: LogoCandidate | null) => void;
  vendorLogoFilename?: string;
  customerLogoFilename?: string;
  /** Table style names detected from template */
  tableStyleNames?: string[];
  /** Currently selected table style */
  selectedTableStyle?: string;
  onTableStyleChanged?: (styleName: string) => void;
}

const DOC_TYPE_SUGGESTIONS = [
  'Technical Specification',
  'Solution Proposal Document (SPD)',
  'High-Level Design (HLD)',
  'Low-Level Design (LLD)',
  'Interface Specification',
  'Architecture Document',
  'Requirements Specification',
];

const VERSION_STATUS_OPTIONS = ['DRAFT', 'FOR REVIEW', 'RELEASED'];

export default function DocumentMetadataEditor({
  logoCandidates,
  onLogoAssigned,
  vendorLogoFilename,
  customerLogoFilename,
  tableStyleNames,
  selectedTableStyle,
  onTableStyleChanged,
}: DocumentMetadataEditorProps) {
  const specTitle = useProjectStore((state) => state.project?.specification.title);
  const metadata = useProjectStore((state) => state.project?.specification.metadata);
  const updateMetadata = useProjectStore((state) => state.updateDocumentMetadata);
  // Update spec title via direct store set (no dedicated action exists)
  const setSpecTitle = useProjectStore((state) => state.setSpecTitle);
  const [showDocTypeSuggestions, setShowDocTypeSuggestions] = useState(false);

  if (!metadata) return null;

  // --- Document Release helpers ---
  const release = metadata.documentRelease || [];
  const updateRelease = (entries: DocumentReleaseEntry[]) => {
    updateMetadata({ documentRelease: entries });
  };
  const addReleaseEntry = () => {
    updateRelease([...release, { role: 'Reviewer', name: '', title: '', date: '' }]);
  };
  const removeReleaseEntry = (index: number) => {
    updateRelease(release.filter((_, i) => i !== index));
  };
  const updateReleaseField = (index: number, field: keyof DocumentReleaseEntry, value: string) => {
    const updated = [...release];
    updated[index] = { ...updated[index], [field]: value };
    updateRelease(updated);
  };

  // --- Approvers helpers ---
  const approvers = metadata.approvers || [];
  const updateApprovers = (entries: Approver[]) => {
    updateMetadata({ approvers: entries });
  };
  const addApprover = () => {
    updateApprovers([...approvers, { name: '', title: '', date: '' }]);
  };
  const removeApprover = (index: number) => {
    updateApprovers(approvers.filter((_, i) => i !== index));
  };
  const updateApproverField = (index: number, field: keyof Approver, value: string) => {
    const updated = [...approvers];
    updated[index] = { ...updated[index], [field]: value };
    updateApprovers(updated);
  };

  // --- Revisions helpers ---
  const revisions = metadata.revisions || [];
  const updateRevisions = (entries: Revision[]) => {
    updateMetadata({ revisions: entries });
  };
  const addRevision = () => {
    const nextVersion = revisions.length > 0
      ? `0.${revisions.length + 1}`
      : '0.1';
    updateRevisions([...revisions, {
      version: nextVersion,
      author: metadata.author || '',
      changes: '',
      date: new Date().toISOString().split('T')[0],
    }]);
  };
  const removeRevision = (index: number) => {
    updateRevisions(revisions.filter((_, i) => i !== index));
  };
  const updateRevisionField = (index: number, field: keyof Revision, value: string) => {
    const updated = [...revisions];
    updated[index] = { ...updated[index], [field]: value };
    updateRevisions(updated);
  };

  const inputClass = 'w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const sectionClass = 'space-y-3';

  return (
    <div className="space-y-6">
      {/* Cover Page Info */}
      <div className={sectionClass}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
          Cover Page
        </h3>

        <div>
          <label className={labelClass}>Document Title</label>
          <input
            type="text"
            value={specTitle || ''}
            onChange={(e) => setSpecTitle(e.target.value)}
            placeholder="e.g., Wi-Fi Offload Solution"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Customer Name</label>
            <input
              type="text"
              value={metadata.customer || ''}
              onChange={(e) => updateMetadata({ customer: e.target.value })}
              placeholder="e.g., Djibouti Telecom"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Document Date</label>
            <input
              type="date"
              value={metadata.date || new Date().toISOString().split('T')[0]}
              onChange={(e) => updateMetadata({ date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <label className={labelClass}>Document Type</label>
            <input
              type="text"
              value={metadata.documentType || ''}
              onChange={(e) => updateMetadata({ documentType: e.target.value })}
              onFocus={() => setShowDocTypeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDocTypeSuggestions(false), 200)}
              placeholder="e.g., Technical Specification"
              className={inputClass}
            />
            {showDocTypeSuggestions && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-40 overflow-y-auto">
                {DOC_TYPE_SUGGESTIONS.filter(s =>
                  !metadata.documentType || s.toLowerCase().includes((metadata.documentType || '').toLowerCase())
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    onMouseDown={() => {
                      updateMetadata({ documentType: suggestion });
                      setShowDocTypeSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Version Status</label>
            <select
              value={metadata.versionStatus || ''}
              onChange={(e) => updateMetadata({ versionStatus: e.target.value })}
              className={inputClass}
            >
              <option value="">Select status...</option>
              {VERSION_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Version</label>
            <input
              type="text"
              value={metadata.version || ''}
              onChange={(e) => updateMetadata({ version: e.target.value })}
              placeholder="e.g., 1.0"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Author</label>
            <input
              type="text"
              value={metadata.author || ''}
              onChange={(e) => updateMetadata({ author: e.target.value })}
              placeholder="e.g., J. Smith"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Logo Assignment */}
      {logoCandidates.length > 0 && (
        <div className={sectionClass}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
            Logos (from template)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* Vendor logo */}
            <div>
              <label className={labelClass}>Vendor Logo</label>
              <select
                value={vendorLogoFilename || ''}
                onChange={(e) => {
                  const candidate = logoCandidates.find(c => c.filename === e.target.value) || null;
                  onLogoAssigned('vendor', candidate);
                }}
                className={inputClass}
              >
                <option value="">None</option>
                {logoCandidates.map((c) => (
                  <option key={c.filename} value={c.filename}>
                    {c.filename} ({(c.size / 1024).toFixed(0)}KB)
                  </option>
                ))}
              </select>
              {vendorLogoFilename && (
                <img
                  src={logoCandidates.find(c => c.filename === vendorLogoFilename)?.dataUrl}
                  alt="Vendor logo"
                  className="mt-2 max-h-16 object-contain bg-white rounded border border-gray-200 dark:border-gray-600 p-1"
                />
              )}
            </div>
            {/* Customer logo */}
            <div>
              <label className={labelClass}>Customer Logo</label>
              <select
                value={customerLogoFilename || ''}
                onChange={(e) => {
                  const candidate = logoCandidates.find(c => c.filename === e.target.value) || null;
                  onLogoAssigned('customer', candidate);
                }}
                className={inputClass}
              >
                <option value="">None</option>
                {logoCandidates.map((c) => (
                  <option key={c.filename} value={c.filename}>
                    {c.filename} ({(c.size / 1024).toFixed(0)}KB)
                  </option>
                ))}
              </select>
              {customerLogoFilename && (
                <img
                  src={logoCandidates.find(c => c.filename === customerLogoFilename)?.dataUrl}
                  alt="Customer logo"
                  className="mt-2 max-h-16 object-contain bg-white rounded border border-gray-200 dark:border-gray-600 p-1"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Style */}
      {tableStyleNames && tableStyleNames.length > 0 && (
        <div className={sectionClass}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-1">
            Table Style
          </h3>
          <div>
            <label className={labelClass}>Style for tables in exported document</label>
            <select
              value={selectedTableStyle || ''}
              onChange={(e) => onTableStyleChanged?.(e.target.value)}
              className={inputClass}
            >
              <option value="">Default (from template)</option>
              {tableStyleNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Document Release */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Document Release</h3>
          <button onClick={addReleaseEntry} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + Add
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-1 pr-1 w-24">Role</th>
              <th className="pb-1 pr-1">Name</th>
              <th className="pb-1 pr-1">Title</th>
              <th className="pb-1 pr-1 w-28">Date</th>
              <th className="pb-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {release.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1 pr-1">
                  <select value={entry.role} onChange={(e) => updateReleaseField(i, 'role', e.target.value)} className={inputClass}>
                    <option value="Author">Author</option>
                    <option value="Reviewer">Reviewer</option>
                  </select>
                </td>
                <td className="py-1 pr-1">
                  <input type="text" value={entry.name} onChange={(e) => updateReleaseField(i, 'name', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="text" value={entry.title} onChange={(e) => updateReleaseField(i, 'title', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="date" value={entry.date || ''} onChange={(e) => updateReleaseField(i, 'date', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1">
                  <button onClick={() => removeReleaseEntry(i)} className="text-red-500 hover:text-red-700 text-xs">x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {release.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No entries — click + Add to start</p>
        )}
      </div>

      {/* Customer Sign-off */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Customer Sign-off</h3>
          <button onClick={addApprover} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + Add
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-1 pr-1">Name</th>
              <th className="pb-1 pr-1">Title</th>
              <th className="pb-1 pr-1 w-28">Date</th>
              <th className="pb-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {approvers.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1 pr-1">
                  <input type="text" value={entry.name} onChange={(e) => updateApproverField(i, 'name', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="text" value={entry.title} onChange={(e) => updateApproverField(i, 'title', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="date" value={entry.date || ''} onChange={(e) => updateApproverField(i, 'date', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1">
                  <button onClick={() => removeApprover(i)} className="text-red-500 hover:text-red-700 text-xs">x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {approvers.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No entries — click + Add to start</p>
        )}
      </div>

      {/* Revision History */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revision History</h3>
          <button onClick={addRevision} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + Add
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-1 pr-1 w-16">Rev</th>
              <th className="pb-1 pr-1 w-24">Name</th>
              <th className="pb-1 pr-1">Changes</th>
              <th className="pb-1 pr-1 w-28">Date</th>
              <th className="pb-1 w-6"></th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-1 pr-1">
                  <input type="text" value={entry.version} onChange={(e) => updateRevisionField(i, 'version', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="text" value={entry.author} onChange={(e) => updateRevisionField(i, 'author', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="text" value={entry.changes} onChange={(e) => updateRevisionField(i, 'changes', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1 pr-1">
                  <input type="date" value={entry.date} onChange={(e) => updateRevisionField(i, 'date', e.target.value)} className={inputClass} />
                </td>
                <td className="py-1">
                  <button onClick={() => removeRevision(i)} className="text-red-500 hover:text-red-700 text-xs">x</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {revisions.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">No entries — click + Add to start</p>
        )}
      </div>
    </div>
  );
}
