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
  {
    id: 'reuters',
    name: 'Reuters',
    domain: 'reuters.com',
    did: 'did:plc:jbvnehrrdqoulco4rf5gxg5r',
  },
  {
    id: 'associated-press',
    name: 'The Associated Press',
    domain: 'apnews.com',
    did: 'did:plc:a67zdrt4nl2tv2qojpngogbq',
  },
  {
    id: 'the-guardian',
    name: 'The Guardian',
    domain: 'theguardian.com',
    did: 'did:plc:vovinwhtulbsx4mwfw26r5ni',
  },
  {
    id: 'cnn',
    name: 'CNN',
    domain: 'cnn.com',
    did: 'did:plc:dzezcmpb3fhcpns4n4xm4ur5',
  },
  {
    id: 'npr',
    name: 'NPR',
    domain: 'npr.org',
    did: 'did:plc:ln72v57ivz2g46uqf4xxqiuh',
  },
  {
    id: 'france-24',
    name: 'FRANCE 24',
    domain: 'france24.com',
    did: 'did:plc:wkreszch2k4mumsrlkeaflgn',
  },
  {
    id: 'politico-europe',
    name: 'POLITICO Europe',
    domain: 'politico.eu',
    did: 'did:plc:bak7f4b3jsiqlpyo6o4ejaji',
  },
  {
    id: 'der-spiegel',
    name: 'DER SPIEGEL',
    domain: 'spiegel.de',
    did: 'did:plc:6xofcnvvojjnmggqx43zghwh',
  },
  {
    id: 'die-zeit',
    name: 'DIE ZEIT',
    domain: 'zeit.de',
    did: 'did:plc:42pjb4dy3p3ubiekmwpkthen',
  },
  {
    id: 'le-monde',
    name: 'Le Monde',
    domain: 'lemonde.fr',
    did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4',
  },
] as const

export function findPublisherByDid(did?: string) {
  return PUBLISHERS.find(publisher => publisher.did === did)
}

export function findPublisher(id?: string) {
  return PUBLISHERS.find(publisher => publisher.id === id)
}
