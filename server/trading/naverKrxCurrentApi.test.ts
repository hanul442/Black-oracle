import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNaverStockListPayload } from './equity/naverKrxResearchMarketData';

test('current stock.naver domestic volume-ranking payload is normalized without inventing missing fields', () => {
  const rows = parseNaverStockListPayload([
    {
      itemcode: '000660',
      itemname: 'SK하이닉스',
      nowPrice: '250,000',
      prevChangeRate: '2.50',
      accumulatedTradingVolume: '2,000,000',
      accumulatedTradingValue: '500,000,000,000',
    },
  ], 'KOSPI');

  assert.deepEqual(rows, [{
    symbol: '000660',
    name: 'SK하이닉스',
    price: 250_000,
    volume: 2_000_000,
    turnoverKrw: 500_000_000_000,
    changeRate: 0.025,
    rank: 1,
    marketName: 'KOSPI',
  }]);
});

test('current Naver parser fails closed when volume is absent', () => {
  const rows = parseNaverStockListPayload([
    {
      itemcode: '000660',
      itemname: 'SK하이닉스',
      nowPrice: '250,000',
      prevChangeRate: '2.50',
    },
  ], 'KOSPI');

  assert.equal(rows.length, 0);
});
