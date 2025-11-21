/**
 * Built-in Specification Templates
 *
 * This module exports all built-in templates for technical specifications.
 * Templates define the structure, sections, and formatting guidance for different
 * specification types and domains.
 */

import { template3GPP } from './3gpp';
import { templateIEEE830 } from './ieee830';
import { templateISO29148 } from './iso29148';
import type { SpecificationTemplate } from '../../types';

/**
 * All built-in templates available in the application
 */
export const builtInTemplates: SpecificationTemplate[] = [
  template3GPP,
  templateIEEE830,
  templateISO29148,
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): SpecificationTemplate | undefined {
  return builtInTemplates.find(t => t.id === id);
}

/**
 * Get templates by domain
 */
export function getTemplatesByDomain(domain: string): SpecificationTemplate[] {
  return builtInTemplates.filter(t => t.domain === domain);
}

/**
 * Get all available domains
 */
export function getAvailableDomains(): string[] {
  const domains = new Set(builtInTemplates.map(t => t.domain));
  return Array.from(domains);
}

// Re-export individual templates for direct access
export { template3GPP, templateIEEE830, templateISO29148 };
