import express from 'express';
import http from 'node:http';
import { spawn } from 'node:child_process';
import tradingStatusHandler from './api/trading-status';
import activityBriefHandler from './api/activity-brief';

const gatewayPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.INTERNAL_PORT || 3001);
const internalHost = '127.0.0.1';

const child = spawn(process.execPath, ['dist/server.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    INTERNAL_PORT: String(internalPort),
  },
});

child.on('exit', (code, signal) => {
  if (!signal) console.error(`Black Oracle internal server exited with code ${code ?? 'unknown'}.`);
});

const app = express();

app.get('/api/trading-status', (req, res) => {
  void tradingStatusHandler(req, res);
});

app.post('/api/activity-brief', express.json({ limit: '1mb' }), (req, res) => {
  void activityBriefHandler(req, res);
});

app.use((req, res) => {
  const upstream = http.request(
    {
      hostname: internalHost,
      port: internalPort,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${internalHost}:${internalPort}`,
      },
    },
    (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value !== undefined) res.setHeader(key, value as string | string[]);
      }
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    console.error('Railway gateway proxy error:', error.message);
    if (!res.headersSent) {
      res.status(503).json({ success: false, error: 'Black Oracle internal server is starting or unavailable.' });
    } else {
      res.end();
    }
  });

  req.pipe(upstream);
});

const server = app.listen(gatewayPort, '0.0.0.0', () => {
  console.log(`Black Oracle Railway gateway listening on 0.0.0.0:${gatewayPort}; internal app on ${internalHost}:${internalPort}.`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
