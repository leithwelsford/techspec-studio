/**
 * Context Window Warning Component
 *
 * Displays context window usage with visual progress bar
 * and warnings when approaching model limits.
 *
 * Features:
 * - Visual progress bar (green/yellow/red)
 * - Per-component token breakdown
 * - Warning messages when near limit
 * - Recommendations for reducing context
 */

import { useMemo } from 'react';
import { formatTokenCount, getModelContextLimit } from '../../services/ai/tokenCounter';

interface ContextWindowWarningProps {
  modelId: string;
  usage: {
    total: number;
    breakdown: {
      brs: number;
      references: number;
      system: number;
      outputReserved?: number;
    };
    referenceDetails?: Array<{
      id: string;
      title: string;
      tokens: number;
    }>;
  };
  showBreakdown?: boolean;
  className?: string;
}

export function ContextWindowWarning({
  modelId,
  usage,
  showBreakdown = true,
  className = '',
}: ContextWindowWarningProps) {
  const contextLimit = getModelContextLimit(modelId);
  const outputReserved = usage.breakdown.outputReserved || 4000;
  const availableForInput = contextLimit - outputReserved;

  const percentUsed = Math.min(100, Math.round((usage.total / availableForInput) * 100));

  // Determine status color
  const status = useMemo(() => {
    if (percentUsed >= 100) return 'error';
    if (percentUsed >= 80) return 'warning';
    return 'ok';
  }, [percentUsed]);

  const statusColors = {
    ok: {
      bar: 'bg-green-500',
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
    },
    warning: {
      bar: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
    },
    error: {
      bar: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
    },
  };

  const colors = statusColors[status];

  // Breakdown percentages
  const brsPercent = Math.round((usage.breakdown.brs / availableForInput) * 100);
  const referencesPercent = Math.round((usage.breakdown.references / availableForInput) * 100);
  const systemPercent = Math.round((usage.breakdown.system / availableForInput) * 100);

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Context Window Usage
        </span>
        <span className={`text-sm font-medium ${colors.text}`}>
          {formatTokenCount(usage.total)} / {formatTokenCount(availableForInput)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-300 ${colors.bar}`}
          style={{ width: `${Math.min(100, percentUsed)}%` }}
        />
      </div>

      {/* Percentage and Status */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs ${colors.text}`}>
          {percentUsed}% used
        </span>
        {status === 'error' && (
          <span className="text-xs font-medium text-red-600 dark:text-red-400">
            Context limit exceeded!
          </span>
        )}
        {status === 'warning' && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Approaching limit
          </span>
        )}
      </div>

      {/* Breakdown */}
      {showBreakdown && (
        <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Token Breakdown
          </p>

          {/* System Prompt */}
          <BreakdownRow
            label="System Prompt"
            tokens={usage.breakdown.system}
            percent={systemPercent}
            color="bg-gray-400"
          />

          {/* BRS Document */}
          <BreakdownRow
            label="BRS Document"
            tokens={usage.breakdown.brs}
            percent={brsPercent}
            color="bg-blue-400"
          />

          {/* References */}
          <BreakdownRow
            label="Reference Documents"
            tokens={usage.breakdown.references}
            percent={referencesPercent}
            color="bg-purple-400"
          />

          {/* Individual reference details */}
          {usage.referenceDetails && usage.referenceDetails.length > 0 && (
            <div className="ml-4 space-y-1 mt-1">
              {usage.referenceDetails.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                >
                  <span className="truncate max-w-[150px]" title={ref.title}>
                    {ref.title}
                  </span>
                  <span>{formatTokenCount(ref.tokens)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Output Reserved */}
          <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-700">
            <BreakdownRow
              label="Reserved for Output"
              tokens={outputReserved}
              percent={Math.round((outputReserved / contextLimit) * 100)}
              color="bg-gray-300"
              muted
            />
          </div>
        </div>
      )}

      {/* Warning Messages */}
      {status !== 'ok' && (
        <div className={`mt-3 p-2 rounded text-xs ${colors.bg} ${colors.text}`}>
          {status === 'error' ? (
            <p>
              <strong>Action required:</strong> Remove some reference documents or reduce BRS content
              to fit within the context window.
            </p>
          ) : (
            <p>
              <strong>Note:</strong> You're approaching the context limit. Consider removing
              non-essential reference documents.
            </p>
          )}
        </div>
      )}

      {/* Model Info */}
      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Model: <span className="font-medium">{modelId}</span> •
          Context: {formatTokenCount(contextLimit)} tokens
        </p>
      </div>
    </div>
  );
}

// ========== Breakdown Row Component ==========

interface BreakdownRowProps {
  label: string;
  tokens: number;
  percent: number;
  color: string;
  muted?: boolean;
}

function BreakdownRow({ label, tokens, percent, color, muted = false }: BreakdownRowProps) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color} ${muted ? 'opacity-50' : ''}`} />
      <span className={`flex-1 text-xs ${muted ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
        {label}
      </span>
      <span className={`text-xs font-medium ${muted ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
        {formatTokenCount(tokens)}
      </span>
      <span className={`text-xs w-10 text-right ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
        {percent}%
      </span>
    </div>
  );
}

// ========== Compact Version ==========

interface ContextWindowCompactProps {
  modelId: string;
  totalTokens: number;
  className?: string;
}

export function ContextWindowCompact({ modelId, totalTokens, className = '' }: ContextWindowCompactProps) {
  const contextLimit = getModelContextLimit(modelId);
  const outputReserved = 4000;
  const availableForInput = contextLimit - outputReserved;
  const percentUsed = Math.min(100, Math.round((totalTokens / availableForInput) * 100));

  const status = percentUsed >= 100 ? 'error' : percentUsed >= 80 ? 'warning' : 'ok';
  const barColor = status === 'error' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-500' : 'bg-green-500';
  const textColor = status === 'error' ? 'text-red-600' : status === 'warning' ? 'text-amber-600' : 'text-gray-600';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentUsed}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${textColor} dark:${textColor.replace('600', '400')}`}>
        {percentUsed}%
      </span>
    </div>
  );
}

export default ContextWindowWarning;
