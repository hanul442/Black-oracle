# HANDOFF — BLACK ORACLE Foundation QA F-01~F-06 Fix

작성일: 2026-09-25 (KST) · ENGINEERING → QA

**상태: ENGINEERING FIX VERIFIED / INDEPENDENT QA RE-VERIFICATION REQUIRED**  
**Foundation 전체 상태: PASS/DONE 아님**  
**운영 게이트 G-01: BLOCKED 유지**

## 인수인계

| 필드 | 내용 |
|---|---|
| PROJECT | BLACK ORACLE / P-001 |
| TASK | 독립 QA F-01~F-06 최소 수정 및 회귀 검증 |
| OWNER | 40 — ENGINEERING |
| STATUS | 수정 및 ENGINEERING 검증 완료 / 독립 QA 재검수 대기 |
| GOAL | Frozen v1 및 기존 Foundation 계약을 변경하지 않고 QA 발견사항 F-01~F-06을 닫는다 |
| BASELINE | `243721203f1e3ad03f771ae8fe123523d5b11a1f` |
| VERIFIED IMPLEMENTATION HEAD | `496cbb6f79b48f47abd0352f91cfcae89ae87c0e` |
| BRANCH | `fix/foundation-qa-f01-f06-20260925` |
| PR | #251 — `fix(foundation): close independent QA F-01–F-06` (Draft) |
| COMPLETED | F-01~F-06 수정, 기존 Foundation 테스트 36개 유지, QA 반례 9개 회귀 테스트 추가, CI/Trading CI 검증 |
| DECISIONS | 새 제품 기능·아키텍처·평가 임계값 없음. 기존 PIT/legacy/lineage/version 계약만 fail-closed하게 강제 |
| OPEN ISSUES | 독립 QA 재검수 미수행. G-01 운영 게이트 BLOCKED |
| NEXT OWNER | 60 — QA |
| NEXT ACTION | QA가 동일 반례 및 발견사항별 재검증 조건을 독립 재실행하고 PASS/FAIL 판정 |

## 기준 확인

작업 시작 전 다음을 확인했다.

- HANUL AI TEAM Constitution v1.0.
- `docs/architecture/BLACK_ORACLE_CANONICAL_FROZEN_V1.md`.
- Foundation 계약 6종:
  - `CANONICAL_DATA_POINT_IN_TIME_V1.md`
  - `DECISION_RUN_VERSION_REGISTRY_V1.md`
  - `EVENT_TRIGGER_EVIDENCE_LINEAGE_V1.md`
  - `SHARED_EVALUATION_V1.md`
  - `MARKET_ASSET_GRAPH_V1.md`
  - `LEGACY_ADAPTER_PASS_V1.md`
- 독립 QA HANDOFF `BLACK_ORACLE_Foundation_QA_HANDOFF_2026-09-25.md`.
- 기준 커밋과 작업 시작 시 원격 `main` 비교: **identical / ahead 0 / behind 0**.

## 변경 범위

### F-01 — PIT 불합격 입력으로 정상 Evaluation 생성

**변경 파일**

- `server/foundation/sharedEvaluation.ts`
- `server/foundation/sharedEvaluation.test.ts`
- `server/foundation/foundationComposition.test.ts`
- `server/foundation/foundationQaRegression.test.ts`
- `docs/architecture/foundation/SHARED_EVALUATION_V1.md`

**수정**

- `pointInTimeComplete=true` caller assertion만으로 Evaluation을 생성하지 않도록 했다.
- Evaluation 입력 경계에서 실제 Canonical Data envelope, 정확한 logicalRecord/revision 참조, `asOf`를 받아 기존 `assessPointInTime` 계약으로 검증한다.
- canonical revision 참조 불일치, cutoff 이후 observation/ingestion은 fail closed한다.
- 이미 cutoff 전에 알려진 미래 예정 이벤트는 기존 PIT 의미론대로 허용한다.
- 새 PIT 엔진, 저장소, migration, 임계값은 추가하지 않았다.

**검증**

- future observed → `OBSERVED_AFTER_AS_OF` 차단.
- future ingested → `INGESTED_AFTER_AS_OF` 차단.
- canonical revision mismatch → 차단.
- known-before-cutoff future event → PASS 가능.
- Evaluation authority 4종은 모두 `false` 유지.

**잔여**

- 실제 producer/persistence wiring은 이번 범위가 아니며 추가하지 않았다.
- 외부 저장소에 이 TypeScript 함수의 직접 consumer가 있다면 새 PIT proof 입력에 맞춘 호출부 변경이 필요할 수 있다. 현재 저장소 typecheck는 PASS다.

### F-02 — legacy의 잘못된 PIT COMPLETE

**변경 파일**

- `server/foundation/canonicalData.ts`
- `server/foundation/foundationQaRegression.test.ts`

**수정**

- legacy COMPLETE에 `logicalRecordId` 존재를 명시적으로 요구한다.
- `ingestedAt < observedAt`이면 `TEMPORAL_ORDER_INVALID`로 기록하고 `LEGACY_INCOMPLETE`로 유지한다.
- 누락 identity/time을 추정하거나 채우지 않는다.

**검증**

- logical ID 없음 → `LEGACY_INCOMPLETE`.
- 시간 역전 → `LEGACY_INCOMPLETE`, canonical 판정도 `TEMPORAL_ORDER_INVALID`.
- 기존 observedAt/revision 누락 legacy는 계속 incomplete.
- 정상 명시 메타데이터는 기존 COMPLETE 경로 유지.

**잔여**

- legacy 원본 row는 변경하지 않는다.

### F-03 — supersession 누락 및 revision 충돌

**변경 파일**

- `server/foundation/canonicalData.ts`
- `server/foundation/foundationQaRegression.test.ts`

**수정**

- eligible revision 중 명시된 `supersedesRevisionId`를 존중하여 superseded revision을 head 후보에서 제외한다.
- 동일 `logicalRecordId + revisionId`가 서로 다른 canonical envelope를 가리키면 입력 순서에 의존해 선택하지 않고 fail closed한다.
- 기존 cutoff eligibility를 먼저 적용하므로 cutoff 이후 revocation/correction은 과거 snapshot에 유입되지 않는다.

**검증**

- 동일 시각 r10이 r9를 supersede → r10 선택, REVOKED graph path 0.
- 동일 revision identity의 ACTIVE/REVOKED 충돌 → 순서 양쪽 모두 reject.
- 기존 later-revocation historical test 유지 및 PASS.

**잔여 / 회귀 위험**

- 과거에 동일 revision identity로 상충 payload를 공급하던 비정상 caller는 이제 임의 선택 대신 오류를 받는다. 이는 Frozen v1 재현성 계약에 따른 의도된 fail-closed 변경이다.

### F-04 — 평가 기준 부재인데 PASS

**변경 파일**

- `server/foundation/sharedEvaluation.ts`
- `server/foundation/foundationQaRegression.test.ts`

**수정**

- required criterion이 하나도 없으면 `PASS`가 아니라 기존 verdict `INSUFFICIENT_DATA`를 사용한다.
- optional-only criteria도 전체 PASS를 만들지 않는다.
- 임계값·최소 표본 수 숫자는 새로 만들지 않았다.

**검증**

- criteria=[] → `INSUFFICIENT_DATA`.
- optional-only FAIL → overall `INSUFFICIENT_DATA`.
- 기존 required PASS/FAIL, 부족 표본, missing metric 테스트 유지.
- authority=false 유지.

**잔여**

- 없음. 임계값 calibration은 Frozen v1 deferred scope 그대로다.

### F-05 — NARS source/hash/발행시각 대응 관계 손실

**변경 파일**

- `server/foundation/legacyFoundationAdapters.ts`
- `server/foundation/foundationQaRegression.test.ts`

**수정**

- 기존 호환 배열 `sourceIds/contentHashes/sourcePublishedAt`는 유지한다.
- 각 source의 `sourceId/contentHash/sourcePublishedAt` 결합을 보존하는 `sourceBindings`를 추가한다.
- 값이 없는 경우 null로 명시하며 추정하지 않는다.
- 동일 hash를 여러 source가 공유하는 경우도 각 binding을 유지한다.

**검증**

- A/B의 hash binding을 바꾸면 projection이 달라짐.
- 동일 hash 공유 source C/D 모두 보존.
- 누락 source/hash/time은 null binding으로 보존.
- `executionAuthority=false` 유지.

**잔여**

- Frozen v1 ingress의 observedAt/ingestedAt/revision/originGroupId 누락은 기존처럼 explicit missing 상태다.

### F-06 — BOR 계약 버전 검증·보존 누락

**변경 파일**

- `server/foundation/legacyFoundationAdapters.ts`
- `server/foundation/foundationQaRegression.test.ts`

**수정**

- 승인된 `bor.alpha-read-model.v1`만 재사용 대상으로 인정한다.
- unsupported/blank schemaVersion은 fail closed한다.
- projection에 원본 지원 계약 버전 `schemaVersion`을 보존한다.
- 기존 citation Evidence ID 보존 및 authority 거부 로직은 유지한다.

**검증**

- `unrelated.v999` → reject.
- `bor.alpha-read-model.v1` → reusable + schemaVersion 보존.
- citation IDs 보존.
- 기존 authority=true rejection test 유지.

**잔여**

- 없음.

## 테스트 및 CI 결과

검증 기준 HEAD: `496cbb6f79b48f47abd0352f91cfcae89ae87c0e`.

### Black Oracle CI — SUCCESS

- Typecheck: PASS.
- Production build: PASS.

### Black Oracle Trading CI — SUCCESS

- Typecheck: PASS.
- Trading core tests: **455 / 455 PASS, fail 0**.
- Supabase trading function typecheck: PASS.
- Trading runtime bundle: PASS.
- PAPER scheduler bundle smoke: PASS.
- Strategy Factory scheduler bundle smoke: PASS.
- Production build: PASS.

Foundation 테스트는 기존 **36개를 삭제하지 않고 유지**했고, QA 반례 **9개**를 신규 회귀 테스트로 추가했다. 따라서 Foundation 범위는 **45개(36 기존 + 9 QA) 전부 PASS**했다.

QA 9개는 CI 로그에서 각각 PASS가 확인됐다.

1. F-02 temporal inversion.
2. F-02 missing logical identity.
3. F-03 explicit supersession.
4. F-03 duplicate revision conflict / order independence.
5. F-04 empty criteria.
6. F-04 optional-only criteria.
7. F-05 NARS source/hash/publication binding.
8. F-06 BOR schema version.
9. F-01 canonical PIT/revision/cutoff/authority boundary.

## 보호 경계 재검증

- Shared Evaluation `executionAuthority=false`.
- Shared Evaluation `liveAuthority=false`.
- Shared Evaluation `productionActivationAuthority=false`.
- Shared Evaluation `promotionAuthority=false`.
- NARS projection `executionAuthority=false`.
- BOR projection `executionAuthority=false`, `reportPublicationAuthority=false`.
- cutoff 이후 correction/revocation은 기존 Point-in-Time 필터에 의해 과거 조회에서 제외된다.
- cutoff 이전에 이미 알려진 미래 예정 이벤트는 계속 허용된다.

## 수행하지 않은 작업

의도적으로 수행하지 않았다.

- DB migration.
- Supabase schema 변경.
- 운영 writer 변경.
- scheduler 변경.
- Risk 변경.
- PAPER/실거래 권한 전환.
- Railway 배포.
- 운영 서비스 retirement.
- G-01 해제 또는 현재 DB 복구 여부 재판정.

## G-01

**BLOCKED 유지.**

이번 ENGINEERING 수정은 pure-contract/code/test 범위다. 독립 QA HANDOFF가 분리한 migration/runtime-authority cutover 운영 게이트를 재평가하거나 해제하지 않았다.

## 최종 ENGINEERING 판단

F-01~F-06에 대해 승인된 Frozen v1/Foundation 계약 안에서 최소 수정과 회귀 검증을 완료했다.

이 문서는 **Foundation 전체 PASS/DONE 선언이 아니다.** 독립 작성자와 검증자를 분리하는 원칙에 따라 다음 판정 권한은 QA에 있다.

**NEXT OWNER: 60 — QA**  
**NEXT ACTION: PR #251 / verified implementation HEAD를 독립 재검수하고 F-01~F-06 및 G-01 상태를 새 HANDOFF로 판정한다.**
