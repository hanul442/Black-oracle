import fs from 'fs';

let code = fs.readFileSync('src/store.tsx', 'utf-8');

code = code.replace(
  `async function seedDataIfEmpty() {
  const sourcesSnap = await getDocs(collection(db, "sources"));
  const scenariosSnap = await getDocs(collection(db, "scenarios"));
  if (sourcesSnap.empty || scenariosSnap.empty) {
    const promises = [];
    for (const item of initialSources)
      promises.push(setDoc(doc(db, "sources", item.id), item));
    for (const item of initialSignals)
      promises.push(setDoc(doc(db, "signals", item.id), item));
    for (const item of initialQuestions)
      promises.push(setDoc(doc(db, "questions", item.id), item));
    for (const item of initialHypotheses)
      promises.push(setDoc(doc(db, "hypotheses", item.id), item));
    for (const item of initialEvidence)
      promises.push(setDoc(doc(db, "evidence", item.id), item));
    for (const item of initialScenarios)
      promises.push(setDoc(doc(db, "scenarios", item.id), item));
    for (const item of initialPredictions)
      promises.push(setDoc(doc(db, "predictions", item.id), item));
    for (const item of initialReports)
      promises.push(setDoc(doc(db, "reports", item.id), item));
    await Promise.all(promises);
  }
}`,
  `async function seedDataIfEmpty(userId: string) {
  const getColRef = (col: string) => collection(db, "users", userId, col);
  const getDocRef = (col: string, id: string) => doc(db, "users", userId, col, id);

  const sourcesSnap = await getDocs(getColRef("sources"));
  const scenariosSnap = await getDocs(getColRef("scenarios"));
  if (sourcesSnap.empty || scenariosSnap.empty) {
    const promises = [];
    for (const item of initialSources)
      promises.push(setDoc(getDocRef("sources", item.id), item));
    for (const item of initialSignals)
      promises.push(setDoc(getDocRef("signals", item.id), item));
    for (const item of initialQuestions)
      promises.push(setDoc(getDocRef("questions", item.id), item));
    for (const item of initialHypotheses)
      promises.push(setDoc(getDocRef("hypotheses", item.id), item));
    for (const item of initialEvidence)
      promises.push(setDoc(getDocRef("evidence", item.id), item));
    for (const item of initialScenarios)
      promises.push(setDoc(getDocRef("scenarios", item.id), item));
    for (const item of initialPredictions)
      promises.push(setDoc(getDocRef("predictions", item.id), item));
    for (const item of initialReports)
      promises.push(setDoc(getDocRef("reports", item.id), item));
    await Promise.all(promises);
  }
}`
);

// inside useEffect, replace collection(db, 'xxx') with collection(db, 'users', user.uid, 'xxx')
const colNames = ['sources', 'signals', 'questions', 'hypotheses', 'evidence', 'scenarios', 'predictions', 'reports'];
colNames.forEach(col => {
  code = code.replace(new RegExp(`collection\\(db,\\s*"${col}"\\)`, 'g'), `collection(db, "users", user.uid, "${col}")`);
});

// Update the call to seedDataIfEmpty
code = code.replace('seedDataIfEmpty().catch(console.error);', 'seedDataIfEmpty(user.uid).catch(console.error);');

// Handle deleteSource
code = code.replace(/deleteDoc\(doc\(db, "sources", id\)\)/g, 'deleteDoc(doc(db, "users", user!.uid, "sources", id))');

fs.writeFileSync('src/store.tsx', code);
