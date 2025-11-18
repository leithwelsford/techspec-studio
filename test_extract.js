// Test extractSection logic

const markdown = `## 6 Architecture Overview
This is section 6 content.

## 7 Policy and Charging Control
This is section 7 content about PCC.

## 8 Information Elements
This is section 8 content about IE.

## 9 Error Handling
This is section 9 content.`;

function extractSection(fullDocument, sectionId, sectionTitle) {
  const escapedId = sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const patterns = [
    new RegExp(`^##\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    new RegExp(`^###\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    new RegExp(`^####\\s*${escapedId}\\s+${sectionTitle}.*?$`, 'im'),
    new RegExp(`^##\\s*${escapedId}:\\s+${sectionTitle}.*?$`, 'im'),
    new RegExp(`^##\\s*${escapedId}\\s+.*?$`, 'im'),
    new RegExp(`^###\\s*${escapedId}\\s+.*?$`, 'im'),
    new RegExp(`^####\\s*${escapedId}\\s+.*?$`, 'im'),
  ];

  for (const pattern of patterns) {
    console.log(`Trying pattern: ${pattern.source}`);
    const match = fullDocument.match(pattern);
    if (match && match.index !== undefined) {
      console.log(`✓ Pattern matched: "${match[0]}"`);
      const startIndex = match.index;
      const headingLevel = (match[0].match(/^#+/)?.[0].length) || 2;
      console.log(`  Heading level: ${headingLevel}`);

      const afterStart = fullDocument.substring(startIndex + match[0].length);
      const endPattern = new RegExp(`^#{1,${headingLevel}}[^#]`, 'm');
      const endMatch = afterStart.match(endPattern);

      if (endMatch && endMatch.index !== undefined) {
        const result = fullDocument.substring(startIndex, startIndex + match[0].length + endMatch.index);
        console.log(`  Found end pattern at offset: ${endMatch.index}`);
        return result;
      } else {
        return fullDocument.substring(startIndex);
      }
    }
  }
  return null;
}

// Test case: Extract "7 Policy and Charging Control" with title that doesn't match
console.log('\n=== Test 1: Extract section 7 with exact title ===');
const result1 = extractSection(markdown, '7', 'Policy and Charging Control');
console.log('Result:', result1);

// Test case: Extract section 8 using wrong title
console.log('\n=== Test 2: Extract section 8 using title "Information Elements" ===');
const result2 = extractSection(markdown, '8', 'Information Elements');
console.log('Result:', result2);

// Test case: AI reports section "7" but with title "Policy and Charging Control"
// But looking for it actually finds something else
console.log('\n=== Test 3: Demonstrate the bug ===');
// If AI analysis reports: sectionId: "7", sectionTitle: "Policy and Charging Control"
// But the document might have the heading as "## 7 Policy & Charging" (different wording)
const buggyMarkdown = `## 6 Architecture Overview
Content 6.

## 7 Policy & Charging
Content 7 (note different wording).

## 8 Information Elements
Content 8.`;

const result3 = extractSection(buggyMarkdown, '7', 'Policy and Charging Control');
console.log('Extracted for section 7 with title "Policy and Charging Control":');
console.log(result3);
