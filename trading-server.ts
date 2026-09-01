import 'dotenv/config';
import express from 'express';
import { registerTradingRoutes } from './server/trading/routes';
import { buildRuntimeHealth } from './server/trading/runtimeHealth';
import {
  restoreRuntimeCheckpoint,
  saveRuntimeCheckpoint,
  startRuntimeAutosave,
  stopRuntimeAutosave,
} from './server/trading/runtimeState';

const app = express();
const port = process.env.TRADING_PORT ? Number(process.env.TRADING_PORT) : 3100;
const resumeLoop = process.env.TRADING_RESUME_LOOP !== 'false';
const autosaveIntervalMs = process.env.TRADING_AUTOSAVE_MS ? Number(process.env.TRADING_AUTOSAVE_MS) : 60_000;

await restoreRuntimeCheckpoint(resumeLoop);
startRuntimeAutosave(autosaveIntervalMs);

app.use(express.json());
registerTradingRoutes(app);

app.get('/health', (_req, res) => {
  const health = buildRuntimeHealth();
  res.status(health.success ? 200 : 503).json(health);
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Black Oracle trading gateway listening on http://localhost:${port}`);
});

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Black Oracle trading gateway received ${signal}; checkpointing before shutdown.`);
  stopRuntimeAutosave();

  try {
    await saveRuntimeCheckpoint(`shutdown-${signal.toLowerCase()}`);
  } catch (error) {
    console.error('Final Black Oracle trading checkpoint failed:', error);
    process.exitCode = 1;
  }

  server.close(() => {
    process.exit(process.exitCode ?? 0);
  });

  setTimeout(() => process.exit(process.exitCode ?? 1), 5_000).unref();
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
