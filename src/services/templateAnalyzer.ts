/**
 * DOCX Template Analyzer
 *
 * Analyzes uploaded DOCX templates to extract styles, numbering, and structure.
 * Generates markdown generation guidance for optimal Pandoc export.
 */

import PizZip from 'pizzip';
import type {
  DocxTemplateAnalysis,
  HeadingStyleInfo,
  ParagraphStyleInfo,
  CaptionStyleInfo,
  NumberingSchemeInfo,
  ListNumberingInfo,
  DocumentStructureInfo,
  TemplateCompatibility,
  CompatibilityIssue,
  TemplateWarning,
  MarkdownGenerationGuidance,
} from '../types';

export class TemplateAnalyzer {
  /**
   * Analyze DOCX template file
   *
   * @param file - DOCX file (File object or base64 string)
   * @returns Complete template analysis
   */
  async analyzeTemplate(file: File | string): Promise<DocxTemplateAnalysis> {
    console.log('[Template Analyzer] Starting analysis...');

    // Load DOCX as ZIP
    const zip = await this.loadDocx(file);

    // Extract XML files
    const xmlFiles = await this.extractXmlFiles(zip);

    // Parse each XML file
    const stylesDoc = this.parseXml(xmlFiles.styles);
    const numberingDoc = this.parseXml(xmlFiles.numbering);
    const documentDoc = this.parseXml(xmlFiles.document);

    // Analyze each component
    const headingStyles = this.analyzeHeadingStyles(stylesDoc);
    const paragraphStyles = this.analyzeParagraphStyles(stylesDoc);
    const captionStyles = this.analyzeCaptionStyles(stylesDoc);
    const sectionNumbering = this.analyzeSectionNumbering(numberingDoc);
    const listNumbering = this.analyzeListNumbering(numberingDoc);
    const documentStructure = this.analyzeDocumentStructure(documentDoc);

    // Compatibility check
    const compatibility = this.checkCompatibility({
      headingStyles,
      sectionNumbering,
      documentStructure,
    });

    // Generate warnings
    const warnings = this.generateWarnings({
      headingStyles,
      captionStyles,
      sectionNumbering,
      compatibility,
    });

    // Build analysis result
    const analysis: DocxTemplateAnalysis = {
      id: crypto.randomUUID(),
      filename: typeof file === 'string' ? 'template.docx' : file.name,
      uploadedAt: new Date(),
      headingStyles,
      paragraphStyles,
      captionStyles,
      sectionNumbering,
      listNumbering,
      documentStructure,
      compatibility,
      warnings,
      rawXml: {
        styles: xmlFiles.styles,
        numbering: xmlFiles.numbering,
        document: xmlFiles.document,
      },
    };

    console.log('[Template Analyzer] Analysis complete:', analysis);
    return analysis;
  }

  /**
   * Generate markdown generation guidance from analysis
   */
  generateMarkdownGuidance(
    analysis: DocxTemplateAnalysis
  ): MarkdownGenerationGuidance {
    console.log('[Template Analyzer] Generating markdown guidance...');

    const guidance: MarkdownGenerationGuidance = {
      headingLevels: {
        maxDepth: this.getMaxHeadingDepth(analysis.headingStyles),
        numberingStyle: this.deriveHeadingNumberingGuidance(
          analysis.sectionNumbering
        ),
      },
      figureFormat: {
        captionPlacement: 'below', // Default, can be detected from template
        numberingPattern: this.deriveFigureNumberingPattern(
          analysis.sectionNumbering
        ),
        syntax: '![{number}: {title}](path)',
      },
      tableFormat: {
        captionPlacement: 'above',
        numberingPattern: this.deriveTableNumberingPattern(
          analysis.sectionNumbering
        ),
        useMarkdownTables: true,
      },
      listFormat: {
        bulletChar: '-',
        orderedStyle: '1.',
      },
      codeBlockStyle: {
        fenced: true,
        languageHints: true,
      },
      emphasis: {
        bold: '**',
        italic: '*',
      },
      sectionBreaks: {
        usePageBreaks: analysis.documentStructure.sectionBreaks > 0,
        pattern: '\\pagebreak',
      },
    };

    console.log('[Template Analyzer] Guidance generated:', guidance);
    return guidance;
  }

  // ===== Private Methods =====

  private async loadDocx(file: File | string): Promise<PizZip> {
    let arrayBuffer: ArrayBuffer;

    if (typeof file === 'string') {
      // Base64 string
      const binary = atob(file);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      // File object
      arrayBuffer = await file.arrayBuffer();
    }

    return new PizZip(arrayBuffer);
  }

  private async extractXmlFiles(zip: PizZip): Promise<{
    styles: string;
    numbering: string;
    document: string;
    settings: string;
  }> {
    const extractFile = (path: string): string => {
      const file = zip.file(path);
      return file ? file.asText() : '';
    };

    return {
      styles: extractFile('word/styles.xml'),
      numbering: extractFile('word/numbering.xml'),
      document: extractFile('word/document.xml'),
      settings: extractFile('word/settings.xml'),
    };
  }

  private parseXml(xmlString: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
  }

  private analyzeHeadingStyles(stylesDoc: Document): HeadingStyleInfo[] {
    console.log('[Template Analyzer] Analyzing heading styles...');
    const headingStyles: HeadingStyleInfo[] = [];

    // Query all style elements with styleId starting with "Heading"
    const styleElements = stylesDoc.querySelectorAll('w\\:style');

    styleElements.forEach((styleEl) => {
      const styleId = styleEl.getAttribute('w:styleId') || '';

      // Check if this is a heading style (Heading1, Heading2, etc.)
      if (/^Heading\d$/.test(styleId)) {
        const level = parseInt(
          styleId.replace('Heading', '')
        ) as 1 | 2 | 3 | 4 | 5 | 6;

        if (level >= 1 && level <= 6) {
          headingStyles.push({
            level,
            styleId,
            font: this.extractFont(styleEl),
            fontSize: this.extractFontSize(styleEl),
            color: this.extractColor(styleEl),
            bold: this.extractBold(styleEl),
            numbering: this.extractNumbering(styleEl),
            spacing: this.extractSpacing(styleEl),
          });
        }
      }
    });

    console.log(
      `[Template Analyzer] Found ${headingStyles.length} heading styles`
    );
    return headingStyles.sort((a, b) => a.level - b.level);
  }

  private analyzeParagraphStyles(
    stylesDoc: Document
  ): ParagraphStyleInfo[] {
    console.log('[Template Analyzer] Analyzing paragraph styles...');
    const paragraphStyles: ParagraphStyleInfo[] = [];

    const styleElements = stylesDoc.querySelectorAll(
      'w\\:style[w\\:type="paragraph"]'
    );

    styleElements.forEach((styleEl) => {
      const styleId = styleEl.getAttribute('w:styleId') || '';
      const nameEl = styleEl.querySelector('w\\:name');
      const name = nameEl?.getAttribute('w:val') || styleId;

      // Skip heading styles (already processed)
      if (/^Heading\d$/.test(styleId)) return;

      paragraphStyles.push({
        styleId,
        name,
        font: this.extractFont(styleEl),
        fontSize: this.extractFontSize(styleEl),
        alignment: this.extractAlignment(styleEl),
        lineSpacing: this.extractLineSpacing(styleEl),
      });
    });

    console.log(
      `[Template Analyzer] Found ${paragraphStyles.length} paragraph styles`
    );
    return paragraphStyles;
  }

  private analyzeCaptionStyles(stylesDoc: Document): CaptionStyleInfo {
    console.log('[Template Analyzer] Analyzing caption styles...');

    // Look for "Caption" style (common in Word templates)
    const captionStyle = stylesDoc.querySelector(
      'w\\:style[w\\:styleId="Caption"]'
    );

    return {
      figureCaption: {
        exists: !!captionStyle,
        styleId: captionStyle ? 'Caption' : undefined,
        format: 'Figure %s: %s', // Default format
        numbering: 'per-section', // Default
      },
      tableCaption: {
        exists: !!captionStyle,
        styleId: captionStyle ? 'Caption' : undefined,
        format: 'Table %s: %s',
        numbering: 'per-section',
      },
    };
  }

  private analyzeSectionNumbering(
    numberingDoc: Document
  ): NumberingSchemeInfo {
    console.log('[Template Analyzer] Analyzing section numbering...');

    // Parse numbering definitions
    const abstractNums = numberingDoc.querySelectorAll('w\\:abstractNum');

    if (abstractNums.length === 0) {
      return {
        detectedPattern: 'none',
        levels: [],
        recommendation:
          'No numbering detected. Pandoc will auto-number based on --number-sections flag.',
      };
    }

    // Analyze first abstract numbering definition
    const firstAbstractNum = abstractNums[0];
    const levels: { level: number; format: string; example: string }[] = [];

    const lvls = firstAbstractNum.querySelectorAll('w\\:lvl');
    lvls.forEach((lvl) => {
      const ilvl = parseInt(lvl.getAttribute('w:ilvl') || '0');
      const numFmtEl = lvl.querySelector('w\\:numFmt');
      const lvlTextEl = lvl.querySelector('w\\:lvlText');

      const numFmt = numFmtEl?.getAttribute('w:val') || 'decimal';
      const lvlText = lvlTextEl?.getAttribute('w:val') || '%1';

      levels.push({
        level: ilvl + 1,
        format: this.formatNumberingPattern(lvlText),
        example: this.generateNumberingExample(lvlText, ilvl + 1),
      });
    });

    // Detect pattern type
    const detectedPattern = this.detectNumberingPattern(levels);

    return {
      detectedPattern,
      levels,
      recommendation: this.generateNumberingRecommendation(detectedPattern),
    };
  }

  private analyzeListNumbering(
    numberingDoc: Document
  ): ListNumberingInfo {
    console.log('[Template Analyzer] Analyzing list numbering...');

    // For now, return sensible defaults
    // More sophisticated detection could check specific list numbering IDs
    return {
      bulletStyle: '-',
      orderedStyle: 'decimal',
    };
  }

  private analyzeDocumentStructure(
    documentDoc: Document
  ): DocumentStructureInfo {
    console.log('[Template Analyzer] Analyzing document structure...');

    // Check for section breaks
    const sectionBreaks = documentDoc.querySelectorAll('w\\:sectPr').length;

    // Basic structure detection
    // More sophisticated detection would parse actual content
    return {
      hasTitlePage: false, // Would need content analysis
      titlePageElements: {
        hasTitle: false,
        hasVersion: false,
        hasDate: false,
        hasAuthor: false,
        hasCompany: false,
      },
      hasTOC: false, // Would need to detect TOC field codes
      tocLocation: 'none',
      sectionBreaks,
      pageOrientation: 'portrait',
      pageSize: 'A4',
    };
  }

  private checkCompatibility(data: {
    headingStyles: HeadingStyleInfo[];
    sectionNumbering: NumberingSchemeInfo;
    documentStructure: DocumentStructureInfo;
  }): TemplateCompatibility {
    console.log('[Template Analyzer] Checking Pandoc compatibility...');

    const issues: CompatibilityIssue[] = [];
    const recommendations: string[] = [];

    // Check for required heading styles
    const requiredHeadings = [1, 2, 3];
    const missingHeadings = requiredHeadings.filter(
      (level) => !data.headingStyles.find((h) => h.level === level)
    );

    if (missingHeadings.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'missing-style',
        description: `Missing heading styles for levels: ${missingHeadings.join(', ')}`,
        affectedElements: missingHeadings.map((l) => `Heading${l}`),
        suggestion:
          'Pandoc will use default styles for missing heading levels',
      });
    }

    // Check numbering compatibility
    if (data.sectionNumbering.detectedPattern === 'mixed') {
      issues.push({
        severity: 'warning',
        type: 'incompatible-numbering',
        description: 'Mixed numbering patterns detected',
        affectedElements: ['Section numbering'],
        suggestion:
          'Consider using consistent numbering (all decimal or all roman)',
      });
    }

    // Calculate compatibility score
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning')
      .length;
    const score = 100 - errorCount * 30 - warningCount * 10;

    return {
      pandocCompatible: errorCount === 0,
      compatibilityScore: Math.max(0, Math.min(100, score)),
      issues,
      recommendations,
    };
  }

  private generateWarnings(data: {
    headingStyles: HeadingStyleInfo[];
    captionStyles: CaptionStyleInfo;
    sectionNumbering: NumberingSchemeInfo;
    compatibility: TemplateCompatibility;
  }): TemplateWarning[] {
    console.log('[Template Analyzer] Generating warnings...');

    const warnings: TemplateWarning[] = [];

    // Check for caption styles
    if (!data.captionStyles.figureCaption.exists) {
      warnings.push({
        type: 'no-caption-style',
        severity: 'medium',
        message: 'No figure caption style detected in template',
        recommendation:
          'Figure captions will use default paragraph style. Consider defining a "Caption" style in your template.',
      });
    }

    // Check for heading gaps (e.g., has Heading1 and Heading3 but not Heading2)
    const headingLevels = data.headingStyles.map((h) => h.level).sort();
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        warnings.push({
          type: 'missing-heading-style',
          severity: 'low',
          message: `Gap in heading levels: ${headingLevels[i - 1]} → ${headingLevels[i]}`,
          recommendation:
            'Pandoc may not format intermediate heading levels correctly',
        });
      }
    }

    console.log(`[Template Analyzer] Generated ${warnings.length} warnings`);
    return warnings;
  }

  // ===== Helper Methods =====

  private extractFont(styleEl: Element): string {
    const rFonts = styleEl.querySelector('w\\:rFonts');
    return (
      rFonts?.getAttribute('w:ascii') ||
      rFonts?.getAttribute('w:hAnsi') ||
      'Calibri'
    );
  }

  private extractFontSize(styleEl: Element): number {
    const szEl = styleEl.querySelector('w\\:sz');
    const sz = szEl?.getAttribute('w:val');
    return sz ? parseInt(sz) / 2 : 11; // Word uses half-points
  }

  private extractColor(styleEl: Element): string {
    const colorEl = styleEl.querySelector('w\\:color');
    return colorEl?.getAttribute('w:val') || '000000';
  }

  private extractBold(styleEl: Element): boolean {
    return !!styleEl.querySelector('w\\:b');
  }

  private extractNumbering(styleEl: Element): {
    enabled: boolean;
    format: string;
    separator: string;
  } {
    // Check if style has numbering reference
    const numPr = styleEl.querySelector('w\\:numPr');
    if (!numPr) {
      return { enabled: false, format: '', separator: '' };
    }

    return {
      enabled: true,
      format: 'auto', // Would need to resolve numbering definition
      separator: '.',
    };
  }

  private extractSpacing(styleEl: Element): {
    beforePt: number;
    afterPt: number;
  } {
    const spacingEl = styleEl.querySelector('w\\:spacing');
    const before = spacingEl?.getAttribute('w:before');
    const after = spacingEl?.getAttribute('w:after');

    return {
      beforePt: before ? parseInt(before) / 20 : 0, // Convert from twips to points
      afterPt: after ? parseInt(after) / 20 : 0,
    };
  }

  private extractAlignment(styleEl: Element): 'left' | 'right' | 'center' | 'justify' {
    const jcEl = styleEl.querySelector('w\\:jc');
    const val = jcEl?.getAttribute('w:val') || 'left';

    if (val === 'both') return 'justify';
    if (val === 'center') return 'center';
    if (val === 'right') return 'right';
    return 'left';
  }

  private extractLineSpacing(styleEl: Element): number {
    const spacingEl = styleEl.querySelector('w\\:spacing');
    const line = spacingEl?.getAttribute('w:line');
    const lineRule = spacingEl?.getAttribute('w:lineRule');

    if (!line) return 1.0;

    // If lineRule is "auto", line value is in 240ths of a line
    if (lineRule === 'auto') {
      return parseInt(line) / 240;
    }

    // Otherwise it's in twips (1/20 pt)
    return parseInt(line) / 240; // Simplified
  }

  private formatNumberingPattern(lvlText: string): string {
    // Convert "%1.%2." to "1.1"
    return lvlText.replace(/%\d/g, (match) => {
      const num = match.substring(1);
      return num;
    });
  }

  private generateNumberingExample(lvlText: string, level: number): string {
    // Generate example like "1.2.3" based on level
    const parts = [];
    for (let i = 1; i <= level; i++) {
      parts.push(i.toString());
    }
    return parts.join('.');
  }

  private detectNumberingPattern(
    levels: { level: number; format: string; example: string }[]
  ): 'decimal' | 'multi-level' | 'mixed' | 'none' {
    if (levels.length === 0) return 'none';
    if (levels.length === 1) return 'decimal';

    // Check if all levels use decimal numbering
    const allDecimal = levels.every((l) => /^\d+/.test(l.example));
    if (allDecimal) {
      return levels.length > 1 ? 'multi-level' : 'decimal';
    }

    return 'mixed';
  }

  private generateNumberingRecommendation(
    pattern: 'decimal' | 'multi-level' | 'mixed' | 'none'
  ): string {
    switch (pattern) {
      case 'none':
        return 'Use Pandoc --number-sections flag for automatic numbering';
      case 'decimal':
        return 'Single-level decimal numbering detected. Markdown headings will auto-number.';
      case 'multi-level':
        return 'Multi-level decimal numbering (1.1, 1.2, etc.). Use # headings and Pandoc will auto-number.';
      case 'mixed':
        return 'Mixed numbering detected. Consider standardizing to decimal (1, 1.1, 1.1.1) for best Pandoc compatibility.';
    }
  }

  private getMaxHeadingDepth(headingStyles: HeadingStyleInfo[]): number {
    if (headingStyles.length === 0) return 3; // Default
    return Math.max(...headingStyles.map((h) => h.level));
  }

  private deriveHeadingNumberingGuidance(
    sectionNumbering: NumberingSchemeInfo
  ): string {
    if (sectionNumbering.detectedPattern === 'none') {
      return 'Use # for level 1, ## for level 2, etc. Do not include numbers - Pandoc will auto-number.';
    }
    return 'Use # for level 1, ## for level 2, etc. Template numbering will be applied by Pandoc.';
  }

  private deriveFigureNumberingPattern(
    sectionNumbering: NumberingSchemeInfo
  ): string {
    if (
      sectionNumbering.detectedPattern === 'multi-level' ||
      sectionNumbering.detectedPattern === 'mixed'
    ) {
      return 'Figure {section}-{number}: {title}'; // e.g., "Figure 4-1: Architecture"
    }
    return 'Figure {number}: {title}'; // e.g., "Figure 1: Architecture"
  }

  private deriveTableNumberingPattern(
    sectionNumbering: NumberingSchemeInfo
  ): string {
    if (
      sectionNumbering.detectedPattern === 'multi-level' ||
      sectionNumbering.detectedPattern === 'mixed'
    ) {
      return 'Table {section}-{number}: {title}';
    }
    return 'Table {number}: {title}';
  }
}

// Singleton instance
export const templateAnalyzer = new TemplateAnalyzer();

/**
 * Get default markdown generation guidance
 * Used when no DOCX template is provided
 *
 * These defaults produce markdown that:
 * - Works well with Pandoc DOCX conversion
 * - Aligns with common technical document standards
 * - Maps cleanly to Word heading styles (# → Heading 1, ## → Heading 2, etc.)
 */
export function getDefaultMarkdownGuidance(): MarkdownGenerationGuidance {
  return {
    headingLevels: {
      maxDepth: 6,
      numberingStyle: 'decimal', // 1, 1.1, 1.1.1 - matches Pandoc --number-sections
    },
    figureFormat: {
      captionPlacement: 'below',
      numberingPattern: 'Figure {chapter}.{number}',
      syntax: '{{fig:id}}',
    },
    tableFormat: {
      captionPlacement: 'above',
      numberingPattern: 'Table {chapter}.{number}',
      useMarkdownTables: true,
    },
    listFormat: {
      bulletChar: '-',
      orderedStyle: '1.',
    },
    codeBlockStyle: {
      fenced: true,
      languageHints: true,
    },
    emphasis: {
      bold: '**',
      italic: '*',
    },
    sectionBreaks: {
      usePageBreaks: false,
      pattern: '---',
    },
  };
}
