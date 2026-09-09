import express from 'express';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import tradingStatusHandler from './api/trading-status';
import tradingPaperCycleHandler from './api/trading-paper-cycle';
import strategyFactoryCycleHandler from './api/strategy-factory-cycle';
import activityBriefHandler from './api/activity-brief';
import eventsHandler from './api/events';
import councilDebateHandler from './api/council-debate';
import aiCostStatusHandler from './api/ai-cost-status';
import { tradingCheckpointStore } from './server/trading/persistence';

const gatewayPort = Number(process.env.PORT || 3000);
const internalPort = Number(process.env.INTERNAL_PORT || 3001);
const internalHost = '127.0.0.1';
const adminUsername = String(process.env.ADMIN_USERNAME || '').trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || '');
const sessionSecret = String(process.env.SESSION_SECRET || adminPassword);
const authConfigured = Boolean(adminUsername && adminPassword);
const sessionCookie = 'bo_session';
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;

type AttemptState = { count: number; resetAt: number };
const loginAttempts = new Map<string, AttemptState>();

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
app.set('trust proxy', 1);

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const signSession = (expiresAt: number) => {
  const payload = `${adminUsername}.${expiresAt}`;
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('hex');
  return `${expiresAt}.${signature}`;
};

const verifySession = (token?: string) => {
  if (!authConfigured || !token) return false;
  const [expiresRaw, signature] = token.split('.');
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return false;
  const expected = createHmac('sha256', sessionSecret)
    .update(`${adminUsername}.${expiresAt}`)
    .digest('hex');
  return safeEqual(signature, expected);
};

const readCookie = (header: string | undefined, name: string) => {
  if (!header) return undefined;
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(pair.slice(separator + 1).trim());
  }
  return undefined;
};

const schedulerBearerAuthorized = (authorization?: string) => {
  if (!authorization?.startsWith('Bearer ')) return false;
  const presented = authorization.slice('Bearer '.length).trim();
  const accepted = [process.env.CRON_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return accepted.some((secret) => safeEqual(secret, presented));
};

const clientKey = (req: express.Request) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  return forwarded || req.ip || 'unknown';
};

const loginPage = (message = '') => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#05070A" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="icon" href="/icons/oracle-192.svg" />
  <title>Black Oracle · Access</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#05070a;color:#f4f6f8}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 5%,#161b22 0,#090c10 34%,#05070a 68%)}
    main{width:min(420px,100%);border:1px solid #252b33;background:rgba(8,11,15,.94);padding:30px 26px 24px;box-shadow:0 24px 80px rgba(0,0,0,.42)}
    .eyebrow{font:600 11px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:#818b98;margin-bottom:15px}.brand{font-size:28px;font-weight:650;letter-spacing:-.04em;margin:0}.sub{font-size:13px;line-height:1.55;color:#8f99a6;margin:8px 0 28px}
    label{display:block;font:600 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#727d89;margin:17px 0 8px}input{width:100%;border:1px solid #2a313a;background:#080b0f;color:#fff;padding:13px 14px;font:500 15px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;outline:none}input:focus{border-color:#697581}
    button{width:100%;margin-top:22px;border:1px solid #e8edf2;background:#e8edf2;color:#06080b;padding:13px 15px;font-weight:750;letter-spacing:.04em;cursor:pointer}.error{border-left:2px solid #d5d9df;padding:9px 11px;margin:0 0 18px;background:#10141a;color:#cfd5dc;font-size:12px;line-height:1.45}
    footer{margin-top:22px;padding-top:16px;border-top:1px solid #1f252d;color:#59636f;font:500 10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;display:flex;justify-content:space-between;gap:12px}
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">RESTRICTED · PAPER OPERATIONS</div>
    <h1 class="brand">BLACK ORACLE</h1>
    <p class="sub">Evidence-backed market intelligence and paper-trading operations.</p>
    ${message ? `<div class="error">${message}</div>` : ''}
    <form method="post" action="/login" autocomplete="on">
      <label for="username">OPERATOR</label>
      <input id="username" name="username" autocomplete="username" required autofocus />
      <label for="password">ACCESS CODE</label>
      <input id="password" name="password" type="password" inputmode="numeric" autocomplete="current-password" required />
      <button type="submit">ENTER ORACLE</button>
    </form>
    <footer><span>AUTH GATE v1</span><span>PAPER ONLY</span></footer>
  </main>
</body>
</html>`;

const proxyToInternal = (req: express.Request, res: express.Response) => {
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
};

app.get('/health', async (_req, res) => {
  try {
    const checkpoint = await tradingCheckpointStore.load();
    res.status(authConfigured && checkpoint ? 200 : 503).json({
      ok: authConfigured && Boolean(checkpoint),
      authConfigured,
      tradingRuntimeAvailable: Boolean(checkpoint),
    });
  } catch (error) {
    console.error('Railway trading healthcheck failed:', error);
    res.status(503).json({ ok: false, authConfigured, tradingRuntimeAvailable: false });
  }
});

for (const publicPath of ['/manifest.webmanifest', '/sw.js']) {
  app.get(publicPath, proxyToInternal);
}
app.get('/icons/*path', proxyToInternal);

app.get('/api/trading-paper-cycle', (req, res) => {
  if (!schedulerBearerAuthorized(req.headers.authorization)) {
    return res.status(401).json({ success: false, error: 'Unauthorized scheduled invocation.' });
  }
  void tradingPaperCycleHandler(req, res);
});

app.post('/api/strategy-factory-cycle', express.json({ limit: '64kb' }), (req, res) => {
  if (!schedulerBearerAuthorized(req.headers.authorization)) {
    return res.status(401).json({ success: false, error: 'Unauthorized Strategy Factory scheduler invocation.' });
  }
  void strategyFactoryCycleHandler(req, res);
});

app.get('/api/trading-status', (req, res, next) => {
  if (!schedulerBearerAuthorized(req.headers.authorization)) return next();
  void tradingStatusHandler(req, res);
});

app.post('/login', express.urlencoded({ extended: false, limit: '16kb' }), (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!authConfigured) return res.status(503).send(loginPage('로그인 설정이 아직 완료되지 않았습니다.'));

  const key = clientKey(req);
  const now = Date.now();
  const existing = loginAttempts.get(key);
  if (existing && existing.resetAt > now && existing.count >= maxLoginAttempts) {
    return res.status(429).send(loginPage('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'));
  }
  if (existing && existing.resetAt <= now) loginAttempts.delete(key);

  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  if (!safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)) {
    const state = loginAttempts.get(key);
    loginAttempts.set(key, {
      count: (state?.count || 0) + 1,
      resetAt: state?.resetAt && state.resetAt > now ? state.resetAt : now + loginWindowMs,
    });
    return res.status(401).send(loginPage('Operator 또는 Access Code가 올바르지 않습니다.'));
  }

  loginAttempts.delete(key);
  const expiresAt = Date.now() + sessionLifetimeSeconds * 1000;
  const token = signSession(expiresAt);
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; Max-Age=${sessionLifetimeSeconds}; HttpOnly; Secure; SameSite=Lax`);
  return res.redirect(303, '/');
});

app.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${sessionCookie}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  res.redirect(303, '/');
});

app.use((req, res, next) => {
  const token = readCookie(req.headers.cookie, sessionCookie);
  if (verifySession(token)) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  return res.status(200).send(loginPage());
});

app.get('/api/trading-status', (req, res) => {
  void tradingStatusHandler(req, res);
});

app.get('/api/events', (req, res) => {
  void eventsHandler(req, res);
});

app.post('/api/activity-brief', express.json({ limit: '16kb' }), (req, res) => {
  void activityBriefHandler(req, res);
});

app.post('/api/council-debate', express.json({ limit: '1mb' }), (req, res) => {
  const internalSecret = String(process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!internalSecret) return res.status(503).json({ success: false, error: 'Council internal authorization is unavailable.' });
  req.headers.authorization = `Bearer ${internalSecret}`;
  void councilDebateHandler(req, res);
});

app.get('/api/ai-cost-status', (req, res) => {
  void aiCostStatusHandler(req, res);
});

app.use(proxyToInternal);

const server = app.listen(gatewayPort, '0.0.0.0', () => {
  console.log(`Black Oracle Railway gateway listening on 0.0.0.0:${gatewayPort}; internal app on ${internalHost}:${internalPort}.`);
  console.log(`Black Oracle auth gate: ${authConfigured ? 'configured' : 'NOT CONFIGURED'}.`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 5000).unref();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
