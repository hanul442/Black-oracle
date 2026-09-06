import assert from 'node:assert/strict';
import test from 'node:test';
import { compareExecutionAdapterLifecycle, compareExecutionAdapters, compareExecutionFills } from './executionAdapterParity';
import type { PaperFill, PaperOrderRequest } from './types';

const BUY_NOTIONAL = 20_000;
const REFERENCE_PRICE = 100;
const SLIPPAGE_BPS = 8;
const BUY_FILL_PRICE = REFERENCE_PRICE * (1 + SLIPPAGE_BPS / 10_000);
const BUY_QUANTITY = BUY_NOTIONAL / BUY_FILL_PRICE;

const buyOrder = (): PaperOrderRequest => ({
  id: 'buy-1', market: 'KRW-TEST', side: 'BUY', notional: BUY_NOTIONAL,
  referencePrice: REFERENCE_PRICE, timestamp: 1_700_000_000_000, strategyVersion: 'BO-TEST',
});

const sellOrder = (): PaperOrderRequest => ({
  id: 'sell-1', market: 'KRW-TEST', side: 'SELL', quantity: BUY_QUANTITY,
  referencePrice: 105, timestamp: 1_700_000_900_000, strategyVersion: 'BO-TEST',
});

test('deterministic replay fill matches the current PaperBroker BUY model', () => {
  const result = compareExecutionAdapters(buyOrder());
  assert.equal(result.parity.status, 'PASS');
  assert.equal(result.parity.quantityParity, true);
  assert.equal(result.parity.fillPriceParity, true);
  assert.equal(result.parity.feeParity, true);
  assert.equal(result.replay.fillPrice, result.paper.fillPrice);
  assert.equal(result.replay.executionAuthority, undefined);
});

test('Replay/PAPER lifecycle remains equal across full BUY then SELL round trip', () => {
  const report = compareExecutionAdapterLifecycle([buyOrder(), sellOrder()]);
  assert.equal(report.status, 'PASS');
  assert.equal(report.orderReports.length, 2);
  assert.equal(report.orderReports.every((item) => item.status === 'PASS'), true);
  assert.equal(report.cashParity, true);
  assert.equal(report.realizedPnlParity, true);
  assert.equal(report.feesParity, true);
  assert.equal(report.positionsParity, true);
  assert.equal(report.replayState.positions.length, 0);
  assert.equal(report.paperState.positions.length, 0);
});

test('open BUY lifecycle preserves equal position quantity and average cost', () => {
  const report = compareExecutionAdapterLifecycle([buyOrder()]);
  assert.equal(report.status, 'PASS');
  assert.equal(report.replayState.positions.length, 1);
  assert.equal(report.paperState.positions.length, 1);
  assert.equal(report.positionsParity, true);
  assert.equal(report.replayState.positions[0].quantity, report.paperState.positions[0].quantity);
  assert.equal(report.replayState.positions[0].averageCost, report.paperState.positions[0].averageCost);
});

test('fill parity rejects a deliberately altered fee assumption', () => {
  const { replay, paper } = compareExecutionAdapters(buyOrder());
  const tampered: PaperFill = { ...replay, fee: replay.fee + 10 };
  const report = compareExecutionFills(tampered, paper);
  assert.equal(report.status, 'REJECT');
  assert.equal(report.feeParity, false);
});

test('custom fee/slippage assumptions remain explicit and comparable', () => {
  const report = compareExecutionAdapterLifecycle([buyOrder()], 1_000_000, { feeBps: 10, slippageBps: 15 });
  assert.equal(report.status, 'PASS');
  assert.equal(report.orderReports[0].slippageParity, true);
  assert.equal(report.orderReports[0].feeParity, true);
});
