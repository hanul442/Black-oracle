import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  FSC_PRESS_RELEASE_RSS,
  isBroadKoreanCryptoRegulatory,
} from '../../api/trading-evidence-refresh.ts';

test('FSC collector uses the official press-release RSS endpoint', () => {
  assert.equal(FSC_PRESS_RELEASE_RSS, 'https://www.fsc.go.kr/about/fsc_bbs_rss/?fid=0111');
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
