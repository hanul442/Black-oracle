import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImpactPathsAsOf,
  createGraphEdge,
  selectGraphEdgesAsOf,
} from './marketAssetGraph';

const t={
  eventTime:'2026-09-01T00:00:00Z',
  observedAt:'2026-09-01T00:01:00Z',
  ingestedAt:'2026-09-01T00:01:02Z',
};

test('graph preserves first, second and deeper-order impact paths',()=>{
  const revisions=[
    createGraphEdge({
      source:'research',
      revisionId:'r1',
      ...t,
      from:{entityType:'EVENT',entityId:'middle-east-supply-shock'},
      to:{entityType:'COMMODITY',entityId:'oil'},
      relationType:'AFFECTS',
      direction:'DIRECTED',
      state:'ACTIVE',
      evidenceIds:['EV-1'],
    }),
    createGraphEdge({
      source:'reference-data',
      revisionId:'r1',
      ...t,
      from:{entityType:'COMMODITY',entityId:'oil'},
      to:{entityType:'COMPANY',entityId:'KOREAN-AIR'},
      relationType:'AFFECTS',
      direction:'DIRECTED',
      state:'ACTIVE',
      sourceDataIds:['ref:airline-fuel-exposure'],
    }),
    createGraphEdge({
      source:'reference-data',
      revisionId:'r1',
      ...t,
      from:{entityType:'COMPANY',entityId:'KOREAN-AIR'},
      to:{entityType:'ASSET',entityId:'KRX-003490'},
      relationType:'ISSUER_OF',
      direction:'DIRECTED',
      state:'ACTIVE',
      sourceDataIds:['ref:issuer-map'],
    }),
  ];

  const paths=buildImpactPathsAsOf(
    revisions,
    {entityType:'EVENT',entityId:'middle-east-supply-shock'},
    '2026-09-02T00:00:00Z',
    3,
  );

  assert.deepEqual(paths.map(path=>path.depth),[1,2,3]);
  assert.equal(paths[2]?.nodes.at(-1)?.entityId,'KRX-003490');
});

test('later graph revocation does not leak backward into historical as-of views',()=>{
  const active=createGraphEdge({
    source:'research',
    revisionId:'r1',
    eventTime:'2026-09-01T00:00:00Z',
    observedAt:'2026-09-01T00:01:00Z',
    ingestedAt:'2026-09-01T00:01:02Z',
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'ASSET',entityId:'A-STOCK'},
    relationType:'ISSUER_OF',
    direction:'DIRECTED',
    state:'ACTIVE',
    sourceDataIds:['issuer-registry-r1'],
  });
  const revoked=createGraphEdge({
    source:'research',
    revisionId:'r2',
    supersedesRevisionId:'r1',
    eventTime:'2026-09-01T00:00:00Z',
    observedAt:'2026-09-03T00:00:00Z',
    ingestedAt:'2026-09-03T00:00:02Z',
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'ASSET',entityId:'A-STOCK'},
    relationType:'ISSUER_OF',
    direction:'DIRECTED',
    state:'REVOKED',
    sourceDataIds:['issuer-registry-r2'],
  });

  const before=selectGraphEdgesAsOf([active,revoked],'2026-09-02T00:00:00Z');
  const after=selectGraphEdgesAsOf([active,revoked],'2026-09-04T00:00:00Z');

  assert.equal(before[0]?.payload.state,'ACTIVE');
  assert.equal(after[0]?.payload.state,'REVOKED');

  assert.equal(buildImpactPathsAsOf([active,revoked],{entityType:'COMPANY',entityId:'A'},'2026-09-02T00:00:00Z').length,1);
  assert.equal(buildImpactPathsAsOf([active,revoked],{entityType:'COMPANY',entityId:'A'},'2026-09-04T00:00:00Z').length,0);
});

test('undirected graph edges traverse both ways without creating cycles',()=>{
  const edge=createGraphEdge({
    source:'sector-map',
    revisionId:'r1',
    ...t,
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'COMPANY',entityId:'B'},
    relationType:'COMPETES_WITH',
    direction:'UNDIRECTED',
    state:'CONTESTED',
    evidenceIds:['EV-COMPETE'],
  });

  const fromA=buildImpactPathsAsOf([edge],{entityType:'COMPANY',entityId:'A'},'2026-09-02T00:00:00Z',4);
  const fromB=buildImpactPathsAsOf([edge],{entityType:'COMPANY',entityId:'B'},'2026-09-02T00:00:00Z',4);
  assert.equal(fromA.length,1);
  assert.equal(fromB.length,1);
  assert.equal(fromA[0]?.depth,1);
  assert.equal(fromB[0]?.depth,1);
});

test('graph refuses unsourced relationships',()=>{
  assert.throws(()=>createGraphEdge({
    source:'unknown',
    revisionId:'r1',
    ...t,
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'SECTOR',entityId:'TECH'},
    relationType:'BELONGS_TO_SECTOR',
    direction:'DIRECTED',
    state:'ACTIVE',
  }),/requires Evidence or canonical source-data lineage/);
});

test('graph logical identity is stable for undirected endpoint ordering',()=>{
  const a=createGraphEdge({
    source:'sector-map',
    revisionId:'r1',
    ...t,
    from:{entityType:'COMPANY',entityId:'A'},
    to:{entityType:'COMPANY',entityId:'B'},
    relationType:'COMPETES_WITH',
    direction:'UNDIRECTED',
    state:'ACTIVE',
    evidenceIds:['EV-1'],
  });
  const b=createGraphEdge({
    source:'sector-map',
    revisionId:'r2',
    ...t,
    from:{entityType:'COMPANY',entityId:'B'},
    to:{entityType:'COMPANY',entityId:'A'},
    relationType:'COMPETES_WITH',
    direction:'UNDIRECTED',
    state:'ACTIVE',
    evidenceIds:['EV-2'],
  });
  assert.equal(a.revision.logicalRecordId,b.revision.logicalRecordId);
});
