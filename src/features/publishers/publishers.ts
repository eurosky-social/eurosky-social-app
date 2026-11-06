/** Temporary operator-owned account list. No RSS, outlet IDs, or aggregator configuration. */
export const PUBLISHERS = [
  {
    id: 'wired',
    name: 'WIRED',
    domain: 'wired.com',
    did: 'did:plc:inz4fkbbp7ms3ixufw6xuvdi',
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    domain: 'theverge.com',
    did: 'did:plc:7exlcsle4mjfhu3wnhcgizz6',
  },
  {
    id: 'financial-times',
    name: 'Financial Times',
    domain: 'ft.com',
    did: 'did:plc:5u54z2qgkq43dh2nzwzdbbhb',
  },
  {
    id: 'euractiv',
    name: 'Euractiv',
    domain: 'euractiv.com',
    did: 'did:plc:npdxsw4zvih4gcyqppoql7qk',
  },
  {
    id: '404-media',
    name: '404 Media',
    domain: '404media.co',
    did: 'did:plc:vcepp6trx4vpe5ourxso4tjl',
  },
] as const

export function findPublisher(id?: string) {
  return PUBLISHERS.find(publisher => publisher.id === id)
}
