/**
 * Built-in Specification Templates
 *
 * This module exports all built-in templates for technical specifications.
 * Templates define the structure, sections, and formatting guidance for different
 * specification types and domains.
 *
 * UPDATED: Templates now include:
 * - suggestedSections: Flexible sections that can be modified, reordered, or removed
 * - domainConfig: Domain-specific configuration for AI generation
 * - Legacy sections array retained for backward compatibility
 */

import { template3GPP, telecomDomainConfig, suggestedSections3GPP } from './3gpp';
import { templateIEEE830, softwareDomainConfig, suggestedSectionsIEEE830 } from './ieee830';
import { templateISO29148, generalDomainConfig, suggestedSectionsISO29148 } from './iso29148';
import type { SpecificationTemplate, FlexibleSection, DomainConfig } from '../../types';

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

/**
 * Get the flexible sections for a template
 * Returns suggestedSections if available, otherwise converts legacy sections
 */
export function getFlexibleSections(template: SpecificationTemplate): FlexibleSection[] {
  if (template.suggestedSections) {
    return template.suggestedSections;
  }

  // Convert legacy sections to flexible format
  return template.sections.map((section, index) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    isRequired: section.required,
    order: index + 1,
  }));
}

/**
 * Get domain configuration for a template
 * Returns domainConfig if available, otherwise creates a generic one
 */
export function getDomainConfig(template: SpecificationTemplate): DomainConfig | undefined {
  if (template.domainConfig) {
    return template.domainConfig;
  }

  // Create a basic domain config from template info
  if (template.domain) {
    return {
      domain: template.domain,
      normativeLanguage: 'RFC2119',
    };
  }

  return undefined;
}

/**
 * Create a blank template with no predefined sections
 * Users can build their specification from scratch
 */
export function createBlankTemplate(name: string, domain?: string): SpecificationTemplate {
  return {
    id: `custom-${Date.now()}`,
    name,
    description: 'Custom template with no predefined sections',
    domain: domain || 'general',
    version: '1.0',
    sections: [],
    suggestedSections: [],
    formatGuidance: `Custom specification document.

Add sections as needed for your requirements.
Use normative language (shall/should/may) for requirements.
Include diagrams using {{fig:diagram-id}} syntax.`,
    createdAt: new Date(),
    modifiedAt: new Date(),
    isBuiltIn: false,
  };
}

/**
 * Clone a template for customization
 */
export function cloneTemplate(template: SpecificationTemplate, newName?: string): SpecificationTemplate {
  return {
    ...template,
    id: `custom-${Date.now()}`,
    name: newName || `${template.name} (Copy)`,
    suggestedSections: template.suggestedSections?.map(s => ({ ...s })),
    domainConfig: template.domainConfig ? { ...template.domainConfig } : undefined,
    isBuiltIn: false,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

// Re-export individual templates for direct access
export { template3GPP, templateIEEE830, templateISO29148 };

// Export domain configurations
export { telecomDomainConfig, softwareDomainConfig, generalDomainConfig };

// Export flexible section arrays for direct access
export { suggestedSections3GPP, suggestedSectionsIEEE830, suggestedSectionsISO29148 };
