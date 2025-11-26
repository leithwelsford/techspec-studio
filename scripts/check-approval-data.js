// Quick debug script to check approval structure
console.log("Checking approval data structure in Review Panel...");
console.log("Expected structure:");
console.log({
  type: 'cascaded-refinement',
  generatedContent: {
    primaryChange: { sectionId, sectionTitle, originalContent, refinedContent },
    propagatedChanges: [{ sectionId, sectionTitle, actionType, originalContent, proposedContent, reasoning, impactLevel, confidence }],
    validation: { issues: [], warnings: [], isConsistent: true },
    impactAnalysis: { totalImpact: 'HIGH', affectedSections: [], reasoning: '' }
  }
});
