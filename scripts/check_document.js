// Read localStorage to check actual document content
const fs = require('fs');

// Since we can't directly access browser localStorage from Node,
// let's check if there's a persisted state file
const stateFile = '.tech-spec-project-state.json';

if (fs.existsSync(stateFile)) {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  console.log('Document length:', state.project?.specification?.markdown?.length || 0);
  console.log('\nFirst 2000 characters:');
  console.log(state.project?.specification?.markdown?.substring(0, 2000) || 'No document');
} else {
  console.log('No persisted state file found');
}
