import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BOK_MONETARY_POLICY_RSS,
  FSC_PRESS_RELEASE_RSS,
  isBroadKoreanCryptoRegulatory,
} from '../../api/trading-evidence-refresh.ts';

test('FSC collector uses the official press-release RSS endpoint', () => {
  assert.equal(FSC_PRESS_RELEASE_RSS, 'https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111');
});

test('Bank of Korea collector uses the official monetary-policy RSS endpoint', () => {
  assert.equal(BOK_MONETARY_POLICY_RSS, 'https://www.bok.or.kr/portal/bbs/P0000559/news.rss?menuNo=200690');
});

test('Korean primary-source filter accepts crypto regulation and rejects unrelated finance news', () => {
  assert.equal(isBroadKoreanCryptoRegulatory('가상자산사업자 검사 및 이용자 보호 관련 보도자료'), true);
  assert.equal(isBroadKoreanCryptoRegulatory('디지털자산 시장 규율체계 개선 방안'), true);
  assert.equal(isBroadKoreanCryptoRegulatory('Virtual asset service provider policy update'), true);
  assert.equal(isBroadKoreanCryptoRegulatory('은행권 주택담보대출 금리 현황'), false);
  assert.equal(isBroadKoreanCryptoRegulatory('금융위원회 과장급 인사'), false);
});

test('FSC evidence remains PRIMARY, source-backed and non-executing in refresh pipeline', async () => {
  const sourceUrl = new URL('../../api/trading-evidence-refresh.ts', import.meta.url);
  const source = await readFile(sourceUrl, 'utf-8');

  assert.match(source, /publisher:\s*'금융위원회'/);
  assert.match(source, /sourceType:\s*'PRIMARY'/);
  assert.match(source, /reliability:\s*0\.94/);
  assert.match(source, /collectFscPrimary\(markets, warnings\)/);
  assert.match(source, /fscPrimary:\s*fscPrimary\.length/);
  assert.match(source, /executionAuthority:\s*false/);
});

test('Bank of Korea evidence is recent-only MACRO context and remains non-executing', async () => {
  const sourceUrl = new URL('../../api/trading-evidence-refresh.ts', import.meta.url);
  const source = await readFile(sourceUrl, 'utf-8');

  assert.match(source, /BOK_MAX_AGE_MS\s*=\s*48\s*\*\s*60\s*\*\s*60_000/);
  assert.match(source, /publisher:\s*'한국은행'/);
  assert.match(source, /sourceType:\s*'MACRO'/);
  assert.match(source, /reliability:\s*0\.96/);
  assert.match(source, /collectBokMacro\(markets, warnings\)/);
  assert.match(source, /bokMacro:\s*bokMacro\.length/);
  assert.match(source, /executionAuthority:\s*false/);
});

test('all external RSS candidates require parseable fresh timestamps before classification', async () => {
  const sourceUrl = new URL('../../api/trading-evidence-refresh.ts', import.meta.url);
  const source = await readFile(sourceUrl, 'utf-8');

  assert.match(source, /const validatedItemTimestamp =/);
  assert.match(source, /if \(!Number\.isFinite\(parsed\)\) return null/);
  assert.match(source, /ageMs < -MAX_SOURCE_FUTURE_SKEW_MS \|\| ageMs > maxAgeMs/);
  assert.doesNotMatch(source, /Number\.isFinite\(parsed\) \? parsed : Date\.now\(\)/);
  assert.match(source, /validatedItemTimestamp\(item, NEWS_MAX_AGE_MS, now\)/);
  assert.match(source, /validatedItemTimestamp\(item, PRIMARY_MAX_AGE_MS, now\)/);
  assert.match(source, /validatedItemTimestamp\(item, BOK_MAX_AGE_MS, now\)/);
});

test('Google News market fetches run concurrently so feed collection fits the scheduler budget', async () => {
  const sourceUrl = new URL('../../api/trading-evidence-refresh.ts', import.meta.url);
  const source = await readFile(sourceUrl, 'utf-8');
  const collectorStart = source.indexOf('const collectGoogleNews');
  const collectorEnd = source.indexOf('const extractOutputText');
  const collector = source.slice(collectorStart, collectorEnd);

  assert.match(collector, /Promise\.all\(markets\.map\(async \(market\)/);
  assert.match(collector, /return batches\.flat\(\)/);
});

test('source candidate IDs use provenance rather than timestamps or feed positions', async () => {
  const sourceUrl = new URL('../../api/trading-evidence-refresh.ts', import.meta.url);
  const source = await readFile(sourceUrl, 'utf-8');

  assert.match(source, /const provenanceDiscriminator =/);
  assert.match(source, /makeCandidateId\(market, provenanceDiscriminator\(item\), 'fsc-korea'\)/);
  assert.match(source, /makeCandidateId\(market, provenanceDiscriminator\(item\), 'bok-monetary-policy'\)/);
});
