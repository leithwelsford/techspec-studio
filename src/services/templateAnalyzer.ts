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
  SpecialStylesInfo,
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
    const specialStyles = this.analyzeSpecialStyles(stylesDoc);
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
      specialStyles,
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
      // Pandoc custom-style attributes - derived from template special styles
      pandocStyles: this.derivePandocStyles(analysis),
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
      const content = file ? file.asText() : '';
      console.log(`[Template Analyzer] Extracted ${path}: ${content.length} chars`);
      return content;
    };

    // Log all files in the ZIP for debugging
    const allFiles = Object.keys(zip.files);
    console.log('[Template Analyzer] Files in DOCX:', allFiles.filter(f => f.startsWith('word/')));

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

    // Try multiple selector approaches for cross-browser compatibility
    // The w: namespace prefix can be tricky with querySelectorAll
    let styleElements: Element[] = [];

    // Approach 1: Try namespaced selector (works in some browsers)
    const nsQuery = stylesDoc.querySelectorAll('w\\:style');
    if (nsQuery.length > 0) {
      styleElements = Array.from(nsQuery);
      console.log(`[Template Analyzer] Found ${styleElements.length} styles via w\\:style selector`);
    }

    // Approach 2: Try without namespace escape (works in other browsers)
    if (styleElements.length === 0) {
      const altQuery = stylesDoc.querySelectorAll('style');
      if (altQuery.length > 0) {
        styleElements = Array.from(altQuery);
        console.log(`[Template Analyzer] Found ${styleElements.length} styles via 'style' selector`);
      }
    }

    // Approach 3: Use getElementsByTagName with local name
    if (styleElements.length === 0) {
      // This gets all elements and filters by local name
      const allElements = stylesDoc.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.localName === 'style' || el.tagName === 'w:style') {
          styleElements.push(el);
        }
      }
      console.log(`[Template Analyzer] Found ${styleElements.length} styles via getElementsByTagName`);
    }

    // Log raw XML for debugging if no styles found
    if (styleElements.length === 0) {
      console.warn('[Template Analyzer] No style elements found. XML structure:',
        stylesDoc.documentElement?.outerHTML?.slice(0, 500) || 'empty');
    }

    styleElements.forEach((styleEl) => {
      // Try both attribute formats
      const styleId = styleEl.getAttribute('w:styleId') || styleEl.getAttribute('styleId') || '';
      const styleType = styleEl.getAttribute('w:type') || styleEl.getAttribute('type') || '';

      // Check if this is a heading style (Heading1, Heading2, etc.)
      // Also check for common variations like "heading 1", "Titre1" (French), etc.
      const headingMatch = styleId.match(/^Heading(\d)$/i) ||
                          styleId.match(/^heading\s*(\d)$/i) ||
                          styleId.match(/^Titre(\d)$/i);

      if (headingMatch) {
        const level = parseInt(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6;

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
          console.log(`[Template Analyzer] Found heading style: ${styleId} (level ${level})`);
        }
      }

      // Also detect styles that are based on headings (basedOn attribute)
      const basedOnEl = styleEl.querySelector('basedOn') ||
                        Array.from(styleEl.children).find(c => c.localName === 'basedOn');
      if (basedOnEl) {
        const basedOn = basedOnEl.getAttribute('w:val') || basedOnEl.getAttribute('val') || '';
        if (/^Heading\d$/i.test(basedOn) && !headingMatch) {
          console.log(`[Template Analyzer] Style ${styleId} is based on ${basedOn}`);
        }
      }
    });

    console.log(
      `[Template Analyzer] Found ${headingStyles.length} heading styles total`
    );
    return headingStyles.sort((a, b) => a.level - b.level);
  }

  private analyzeParagraphStyles(
    stylesDoc: Document
  ): ParagraphStyleInfo[] {
    console.log('[Template Analyzer] Analyzing paragraph styles...');
    const paragraphStyles: ParagraphStyleInfo[] = [];

    // Get all style elements using the same robust approach
    const allElements = stylesDoc.getElementsByTagName('*');
    const styleElements: Element[] = [];
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.localName === 'style' || el.tagName === 'w:style') {
        // Check if it's a paragraph style
        const styleType = el.getAttribute('w:type') || el.getAttribute('type') || '';
        if (styleType === 'paragraph') {
          styleElements.push(el);
        }
      }
    }

    styleElements.forEach((styleEl) => {
      const styleId = styleEl.getAttribute('w:styleId') || styleEl.getAttribute('styleId') || '';

      // Find name element
      const nameEl = Array.from(styleEl.children).find(c => c.localName === 'name');
      const name = nameEl?.getAttribute('w:val') || nameEl?.getAttribute('val') || styleId;

      // Skip heading styles (already processed)
      if (/^Heading\d$/i.test(styleId)) return;

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
    // Use robust element finding approach
    let captionStyle: Element | null = null;
    const allElements = stylesDoc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.localName === 'style' || el.tagName === 'w:style') {
        const styleId = el.getAttribute('w:styleId') || el.getAttribute('styleId') || '';
        if (styleId.toLowerCase() === 'caption') {
          captionStyle = el;
          break;
        }
      }
    }

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

  private analyzeSpecialStyles(stylesDoc: Document): SpecialStylesInfo {
    console.log('[Template Analyzer] Analyzing special styles...');

    // Get all style elements
    const allElements = stylesDoc.getElementsByTagName('*');
    const styleElements: Element[] = [];
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.localName === 'style' || el.tagName === 'w:style') {
        styleElements.push(el);
      }
    }

    // Initialize result
    const result: SpecialStylesInfo = {
      title: { exists: false },
      subtitle: { exists: false },
      tocHeading: { exists: false, levels: 0 },
      tableStyles: { exists: false, styleIds: [] },
      otherStyles: [],
    };

    // Track TOC levels found
    const tocLevels = new Set<number>();

    // Notable style names to capture in otherStyles
    const notableStylePatterns = [
      /^caption$/i,
      /^quote$/i,
      /^footnote/i,
      /^header$/i,
      /^footer$/i,
      /^code$/i,
      /^list/i,
      /^note$/i,
      /^warning$/i,
      /^figure/i,
      /^table\s*caption/i,
      /^block\s*text/i,
    ];

    styleElements.forEach((styleEl) => {
      const styleId = styleEl.getAttribute('w:styleId') || styleEl.getAttribute('styleId') || '';
      const styleType = styleEl.getAttribute('w:type') || styleEl.getAttribute('type') || '';

      // Find name element
      const nameEl = Array.from(styleEl.children).find(c => c.localName === 'name');
      const name = nameEl?.getAttribute('w:val') || nameEl?.getAttribute('val') || styleId;

      // Check for Title style
      if (/^title$/i.test(styleId)) {
        result.title = {
          exists: true,
          styleId,
          font: this.extractFont(styleEl),
          fontSize: this.extractFontSize(styleEl),
        };
        console.log(`[Template Analyzer] Found Title style: ${styleId}`);
      }

      // Check for Subtitle style
      if (/^subtitle$/i.test(styleId)) {
        result.subtitle = {
          exists: true,
          styleId,
          font: this.extractFont(styleEl),
          fontSize: this.extractFontSize(styleEl),
        };
        console.log(`[Template Analyzer] Found Subtitle style: ${styleId}`);
      }

      // Check for TOC Heading styles (TOC, TOCHeading, TOC1-TOC9)
      const tocMatch = styleId.match(/^TOC\s*Heading$/i) || styleId.match(/^TOC(\d)$/i);
      if (tocMatch) {
        result.tocHeading.exists = true;
        if (!result.tocHeading.styleId) {
          result.tocHeading.styleId = styleId;
        }
        if (tocMatch[1]) {
          tocLevels.add(parseInt(tocMatch[1]));
        }
        console.log(`[Template Analyzer] Found TOC style: ${styleId}`);
      }

      // Check for table styles (type="table")
      if (styleType === 'table') {
        result.tableStyles.exists = true;
        result.tableStyles.styleIds.push(styleId);

        // Check if it's the default table style
        const defaultAttr = styleEl.getAttribute('w:default') || styleEl.getAttribute('default');
        if (defaultAttr === '1' || defaultAttr === 'true') {
          result.tableStyles.defaultStyle = styleId;
        }
        console.log(`[Template Analyzer] Found table style: ${styleId}`);
      }

      // Check for other notable styles
      const isNotable = notableStylePatterns.some(pattern => pattern.test(styleId) || pattern.test(name));
      if (isNotable && !result.otherStyles.find(s => s.styleId === styleId)) {
        // Skip if already captured as Title, Subtitle, TOC, or Table
        if (!/^(title|subtitle|toc)/i.test(styleId) && styleType !== 'table') {
          let type: 'paragraph' | 'character' | 'table' = 'paragraph';
          if (styleType === 'character') type = 'character';
          if (styleType === 'table') type = 'table';

          result.otherStyles.push({
            styleId,
            name,
            type,
          });
          console.log(`[Template Analyzer] Found notable style: ${styleId} (${name})`);
        }
      }
    });

    // Set TOC levels count
    result.tocHeading.levels = tocLevels.size > 0 ? Math.max(...tocLevels) : 0;

    console.log(`[Template Analyzer] Special styles analysis complete:`, {
      title: result.title.exists,
      subtitle: result.subtitle.exists,
      tocHeading: result.tocHeading.exists,
      tableStyles: result.tableStyles.styleIds.length,
      otherStyles: result.otherStyles.length,
    });

    return result;
  }

  private analyzeSectionNumbering(
    numberingDoc: Document
  ): NumberingSchemeInfo {
    console.log('[Template Analyzer] Analyzing section numbering...');

    // Helper to find elements by local name
    const findByLocalName = (parent: Element | Document, localName: string): Element[] => {
      const result: Element[] = [];
      const allElements = parent.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        if (allElements[i].localName === localName) {
          result.push(allElements[i]);
        }
      }
      return result;
    };

    // Parse numbering definitions
    const abstractNums = findByLocalName(numberingDoc, 'abstractNum');
    console.log(`[Template Analyzer] Found ${abstractNums.length} abstractNum elements`);

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

    const lvls = findByLocalName(firstAbstractNum, 'lvl');
    lvls.forEach((lvl) => {
      const ilvl = parseInt(lvl.getAttribute('w:ilvl') || lvl.getAttribute('ilvl') || '0');

      // Find numFmt and lvlText children
      const numFmtEl = Array.from(lvl.children).find(c => c.localName === 'numFmt');
      const lvlTextEl = Array.from(lvl.children).find(c => c.localName === 'lvlText');

      const numFmt = numFmtEl?.getAttribute('w:val') || numFmtEl?.getAttribute('val') || 'decimal';
      const lvlText = lvlTextEl?.getAttribute('w:val') || lvlTextEl?.getAttribute('val') || '%1';

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

    // Check for section breaks using robust element finding
    const allElements = documentDoc.getElementsByTagName('*');
    let sectionBreaks = 0;
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].localName === 'sectPr') {
        sectionBreaks++;
      }
    }

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

  /**
   * Helper to find child element by local name (handles namespaced XML)
   */
  private findChildByLocalName(parent: Element, localName: string): Element | null {
    for (let i = 0; i < parent.children.length; i++) {
      if (parent.children[i].localName === localName) {
        return parent.children[i];
      }
    }
    // Also search in descendants (not just direct children)
    const allElements = parent.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].localName === localName) {
        return allElements[i];
      }
    }
    return null;
  }

  /**
   * Helper to get attribute value (handles namespaced attributes)
   */
  private getAttr(el: Element | null, attrName: string): string | null {
    if (!el) return null;
    return el.getAttribute(`w:${attrName}`) || el.getAttribute(attrName);
  }

  private extractFont(styleEl: Element): string {
    const rFonts = this.findChildByLocalName(styleEl, 'rFonts');
    return (
      this.getAttr(rFonts, 'ascii') ||
      this.getAttr(rFonts, 'hAnsi') ||
      'Calibri'
    );
  }

  private extractFontSize(styleEl: Element): number {
    const szEl = this.findChildByLocalName(styleEl, 'sz');
    const sz = this.getAttr(szEl, 'val');
    return sz ? parseInt(sz) / 2 : 11; // Word uses half-points
  }

  private extractColor(styleEl: Element): string {
    const colorEl = this.findChildByLocalName(styleEl, 'color');
    return this.getAttr(colorEl, 'val') || '000000';
  }

  private extractBold(styleEl: Element): boolean {
    return !!this.findChildByLocalName(styleEl, 'b');
  }

  private extractNumbering(styleEl: Element): {
    enabled: boolean;
    format: string;
    separator: string;
  } {
    // Check if style has numbering reference
    const numPr = this.findChildByLocalName(styleEl, 'numPr');
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
    const spacingEl = this.findChildByLocalName(styleEl, 'spacing');
    const before = this.getAttr(spacingEl, 'before');
    const after = this.getAttr(spacingEl, 'after');

    return {
      beforePt: before ? parseInt(before) / 20 : 0, // Convert from twips to points
      afterPt: after ? parseInt(after) / 20 : 0,
    };
  }

  private extractAlignment(styleEl: Element): 'left' | 'right' | 'center' | 'justify' {
    const jcEl = this.findChildByLocalName(styleEl, 'jc');
    const val = this.getAttr(jcEl, 'val') || 'left';

    if (val === 'both') return 'justify';
    if (val === 'center') return 'center';
    if (val === 'right') return 'right';
    return 'left';
  }

  private extractLineSpacing(styleEl: Element): number {
    const spacingEl = this.findChildByLocalName(styleEl, 'spacing');
    const line = this.getAttr(spacingEl, 'line');
    const lineRule = this.getAttr(spacingEl, 'lineRule');

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

  /**
   * Derive Pandoc custom-style settings from template analysis
   * Maps detected template styles to Pandoc fenced div attributes
   */
  private derivePandocStyles(
    analysis: DocxTemplateAnalysis
  ): MarkdownGenerationGuidance['pandocStyles'] {
    const { captionStyles, specialStyles } = analysis;

    // Check if we have enough styles to enable Pandoc custom-style syntax
    const hasCaptionStyle = captionStyles?.figureCaption?.exists || captionStyles?.tableCaption?.exists;
    const hasSpecialStyles = specialStyles && (
      specialStyles.title.exists ||
      specialStyles.subtitle.exists ||
      specialStyles.otherStyles.length > 0
    );

    // Only enable if template has relevant styles
    if (!hasCaptionStyle && !hasSpecialStyles) {
      return {
        enabled: false,
      };
    }

    // Build the pandoc styles mapping
    const pandocStyles: NonNullable<MarkdownGenerationGuidance['pandocStyles']> = {
      enabled: true,
    };

    // Figure caption style
    if (captionStyles?.figureCaption?.exists && captionStyles.figureCaption.styleId) {
      pandocStyles.figureCaption = captionStyles.figureCaption.styleId;
    } else if (specialStyles?.otherStyles.find(s => /caption|figure/i.test(s.name))) {
      const captionStyle = specialStyles.otherStyles.find(s => /caption|figure/i.test(s.name));
      if (captionStyle) pandocStyles.figureCaption = captionStyle.styleId;
    }

    // Table caption style (may be same as figure caption or separate)
    if (captionStyles?.tableCaption?.exists && captionStyles.tableCaption.styleId) {
      pandocStyles.tableCaption = captionStyles.tableCaption.styleId;
    } else if (pandocStyles.figureCaption) {
      // Default to figure caption style if no separate table caption
      pandocStyles.tableCaption = pandocStyles.figureCaption;
    }

    // Look for appendix heading style
    const appendixStyle = specialStyles?.otherStyles.find(s =>
      /appendix/i.test(s.name) || /appendix/i.test(s.styleId)
    );
    if (appendixStyle) {
      pandocStyles.appendixHeading = appendixStyle.styleId;
    }

    // Look for note/warning styles
    const noteStyle = specialStyles?.otherStyles.find(s =>
      /note|warning|important|tip/i.test(s.name)
    );
    if (noteStyle) {
      pandocStyles.noteStyle = noteStyle.styleId;
    }

    // Look for code style
    const codeStyle = specialStyles?.otherStyles.find(s =>
      /code|source|listing/i.test(s.name)
    );
    if (codeStyle) {
      pandocStyles.codeStyle = codeStyle.styleId;
    }

    // Collect other notable styles that might be useful
    const otherMappings: Record<string, string> = {};
    for (const style of specialStyles?.otherStyles || []) {
      // Skip ones we've already mapped
      if (
        style.styleId === pandocStyles.figureCaption ||
        style.styleId === pandocStyles.tableCaption ||
        style.styleId === pandocStyles.appendixHeading ||
        style.styleId === pandocStyles.noteStyle ||
        style.styleId === pandocStyles.codeStyle
      ) {
        continue;
      }
      // Map by style name normalized
      const key = style.name.toLowerCase().replace(/\s+/g, '-');
      otherMappings[key] = style.styleId;
    }

    if (Object.keys(otherMappings).length > 0) {
      pandocStyles.otherStyles = otherMappings;
    }

    console.log('[Template Analyzer] Derived Pandoc styles:', pandocStyles);
    return pandocStyles;
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
    // No custom Pandoc styles by default - requires template analysis
    pandocStyles: {
      enabled: false,
    },
  };
}
