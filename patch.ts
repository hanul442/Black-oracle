import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "// Read Firebase config",
  `import { deleteDoc } from 'firebase/firestore';\nconst getDocRef = (req: any, col: string, id: string) => { const uid = req?.body?.userId || req?.query?.userId || 'anonymous'; return doc(db!, 'users', uid, col, id); };\nconst getColRef = (req: any, col: string) => { const uid = req?.body?.userId || req?.query?.userId || 'anonymous'; return collection(db!, 'users', uid, col); };\n\n// Read Firebase config`
);

// Replace collection(db, ...) with getColRef(req, ...)
code = code.replace(/collection\(\s*db!?\s*,\s*"(.*?)"\s*\)/g, "getColRef(req, '$1')");
code = code.replace(/collection\(\s*db!?\s*,\s*'(.*?)'\s*\)/g, "getColRef(req, '$1')");

// Replace doc(db, ...) with getDocRef(req, ...)
code = code.replace(/doc\(\s*db!?\s*,\s*"(.*?)",\s*(.*?)\)/g, "getDocRef(req, '$1', $2)");
code = code.replace(/doc\(\s*db!?\s*,\s*'(.*?)',\s*(.*?)\)/g, "getDocRef(req, '$1', $2)");

const clearDbEndpoint = `
  app.post('/api/clear-db', async (req, res) => {
    if (!db) return res.status(500).json({ error: 'Firebase not configured' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    
    try {
      const collectionsToClear = ['sources', 'signals', 'questions', 'hypotheses', 'scenarios', 'predictions', 'reports', 'evidence'];
      
      for (const col of collectionsToClear) {
        const colRef = getColRef(req, col);
        const snaps = await getDocs(colRef);
        for (const d of snaps.docs) {
          await deleteDoc(d.ref);
        }
      }
      res.json({ success: true, message: 'Your personal database has been cleared.' });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Failed to clear db: ' + e.toString() });
    }
  });
`;

code = code.replace("app.get('/api/data'", clearDbEndpoint + "\n  app.get('/api/data'");

fs.writeFileSync('server.ts', code);
