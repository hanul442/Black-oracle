import 'dotenv/config';
import express from 'express';
import { registerTradingRoutes } from './server/trading/routes';

const app = express();
const port = process.env.TRADING_PORT ? Number(process.env.TRADING_PORT) : 3100;

app.use(express.json());
registerTradingRoutes(app);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'black-oracle-trading-gateway', mode: 'PUBLIC_DATA_ONLY' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Black Oracle trading gateway listening on http://localhost:${port}`);
});
