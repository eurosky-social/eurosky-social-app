/**
 * The registry of approved news accounts, each tagged with the topics,
 * regions, and languages it covers. This is shared, operator-owned config
 * rather than per-user state, so it lives as a local list instead of in the
 * PDS. The user's own selections live in their private preferences
 * (see ./state/prefs).
 */

export interface NewsRegion {
  id: string
  label: string
  /**
   * The country a province belongs to. A province selects the same accounts
   * as its country, since accounts are tagged by country only.
   */
  parent?: string
}

export interface NewsLanguage {
  id: string
  label: string
}

export interface NewsSource {
  did: string
  handle: string
  displayName: string
  /**
   * The news aggregator's theme slugs the account covers. Empty for general
   * news, which only a reader taking every topic is shown.
   */
  topics: string[]
  regions: string[]
  langs: string[]
}

/**
 * The topic value meaning every topic. The topics themselves are the news
 * aggregator's themes (`/api/themes`), by slug, so nothing here lists them.
 */
export const ALL_TOPICS = 'all'

/**
 * The topics records were written with before they became the news
 * aggregator's themes, by the theme each now reads as. `general` named no
 * subject, only general news, which every topic takes in.
 */
const LEGACY_TOPICS: Record<string, string | null> = {
  sports: 'sport',
  'arts-culture': 'culture',
  general: null,
}

/**
 * A record's topics as theme slugs. One that picked only general news reads
 * as every topic, the only choice that still shows it.
 */
export function topicsAsThemes(topics: string[]): string[] {
  const themes = [
    ...new Set(
      topics
        .map(topic => (topic in LEGACY_TOPICS ? LEGACY_TOPICS[topic] : topic))
        .filter((theme): theme is string => !!theme),
    ),
  ]
  return topics.length > 0 && themes.length === 0 ? [ALL_TOPICS] : themes
}

/**
 * `id` is stored in the user's prefs; `label` is display-only and wrapped for
 * translation at render time.
 */
export const NEWS_REGIONS: NewsRegion[] = [
  {id: 'global', label: 'Global'},
  {id: 'europe', label: 'Europe'},
  {id: 'belgium', label: 'Belgium'},
  {id: 'france', label: 'France'},
  {id: 'germany', label: 'Germany'},
  {id: 'netherlands', label: 'Netherlands'},
  {id: 'spain', label: 'Spain'},
  {id: 'uk', label: 'UK'},
  /*
   * Ids are the Dutch labeler's province label values, so a selected province
   * can be read straight off the stories it labels.
   */
  {id: 'nl-drenthe', label: 'Drenthe', parent: 'netherlands'},
  {id: 'nl-flevoland', label: 'Flevoland', parent: 'netherlands'},
  {id: 'nl-friesland', label: 'Friesland', parent: 'netherlands'},
  {id: 'nl-gelderland', label: 'Gelderland', parent: 'netherlands'},
  {id: 'nl-groningen', label: 'Groningen', parent: 'netherlands'},
  {id: 'nl-limburg', label: 'Limburg', parent: 'netherlands'},
  {id: 'nl-noord-brabant', label: 'Noord-Brabant', parent: 'netherlands'},
  {id: 'nl-noord-holland', label: 'Noord-Holland', parent: 'netherlands'},
  {id: 'nl-overijssel', label: 'Overijssel', parent: 'netherlands'},
  {id: 'nl-utrecht', label: 'Utrecht', parent: 'netherlands'},
  {id: 'nl-zeeland', label: 'Zeeland', parent: 'netherlands'},
  {id: 'nl-zuid-holland', label: 'Zuid-Holland', parent: 'netherlands'},
]

/**
 * The languages news can be read in. Ids are ISO 639-1 codes, as the source
 * registry's `langs` and the Dutch labeler's articles carry them.
 */
export const NEWS_LANGUAGES: NewsLanguage[] = [
  {id: 'en', label: 'English'},
  {id: 'nl', label: 'Dutch'},
  {id: 'de', label: 'German'},
  {id: 'fr', label: 'French'},
  {id: 'es', label: 'Spanish'},
  {id: 'it', label: 'Italian'},
  {id: 'pl', label: 'Polish'},
  {id: 'da', label: 'Danish'},
  {id: 'sv', label: 'Swedish'},
  {id: 'no', label: 'Norwegian'},
  {id: 'fi', label: 'Finnish'},
  {id: 'cs', label: 'Czech'},
]

/**
 * Curated sources: real news accounts on the network, resolved to their DIDs
 * and grouped by their primary region. Tags come from the editorial source
 * registry.
 */
export const NEWS_SOURCES: NewsSource[] = [
  // global
  {
    did: 'did:plc:vcepp6trx4vpe5ourxso4tjl',
    handle: '404media.co',
    displayName: '404 Media',
    topics: ['culture', 'tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:kkf4naxqmweop7dv4l2iqqf5',
    handle: 'aendra.com',
    displayName: 'Aendra Rininsland (FT data)',
    topics: ['tech'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:ffccycfh6c6pmxwkhvq5clkv',
    handle: 'afp.com',
    displayName: 'AFP English',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2lofqead276vtc5647ye7sl2',
    handle: 'aljazeera.com',
    displayName: 'Al Jazeera English',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:a67zdrt4nl2tv2qojpngogbq',
    handle: 'apnews.com',
    displayName: 'AP News',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:wld6fad6xsm4tz4kfkoikun2',
    handle: 'arstechnica.com',
    displayName: 'Ars Technica',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:i3xfsu4onekr2uziapdqcru4',
    handle: 'artforum.com',
    displayName: 'ArtForum',
    topics: ['culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:f6avy7jkujdhusski5n64joj',
    handle: 'axios.com',
    displayName: 'Axios',
    topics: ['politics', 'tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:f2vkoe6mu7hyiyjxwwirkd5l',
    handle: 'bbcnews-world-rss.bsky.social',
    displayName: 'BBC News World (unofficial)',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:sb54dpdfefflykmf5bcfvr7t',
    handle: 'bellingcat.com',
    displayName: 'Bellingcat',
    topics: ['politics'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:uewxgchsjy4kmtu7dcxa77us',
    handle: 'bloomberg.com',
    displayName: 'Bloomberg',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:q7iggtywwxvr7hr7axinzt6q',
    handle: 'opinion.bloomberg.com',
    displayName: 'Bloomberg Opinion',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:r2tqb4cbjkgt4ntcmby64lav',
    handle: 'bmj.com',
    displayName: 'BMJ',
    topics: ['health'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2d6kuvaoa7qi6bq5cwq4isee',
    handle: 'carbonbrief.org',
    displayName: 'Carbon Brief',
    topics: ['climate'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:dkkmie5qxtdcqf6e25ott3vi',
    handle: 'climatechangenews.com',
    displayName: 'Climate Home News',
    topics: ['climate'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:kfygevef2pjjsyu7dfd6xpxi',
    handle: 'courrierinter.bsky.social',
    displayName: 'Courrier International',
    topics: ['politics'],
    regions: ['global', 'france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:kup2mpgz32mi5apmu7ouxbol',
    handle: 'cyclingweekly.com',
    displayName: 'Cycling Weekly',
    topics: ['sport'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:hvnl4jfstxu7764bnsvzjxwl',
    handle: 'desmog.com',
    displayName: 'DeSmog',
    topics: ['climate'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:hpnjvcdy2eb4f7wmrdfuka3h',
    handle: 'engadget.com',
    displayName: 'Engadget',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:x7d6j54pm22ufehkes6jo4jf',
    handle: 'espn.com',
    displayName: 'ESPN',
    topics: ['sport'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:6uybbvnd3pfjh5oztjngzdss',
    handle: 'euronews.com',
    displayName: 'Euronews',
    topics: ['politics'],
    regions: ['global', 'europe'],
    langs: ['en'],
  },
  {
    did: 'did:plc:5u54z2qgkq43dh2nzwzdbbhb',
    handle: 'financialtimes.com',
    displayName: 'Financial Times',
    topics: ['politics'],
    regions: ['global', 'europe', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:pc2h3k5a3adhg7lkkcfkwhvc',
    handle: 'foreignaffairs.com',
    displayName: 'Foreign Affairs',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:m5mauk2a3xu2j5nbjbzifm4z',
    handle: 'foreignpolicy.com',
    displayName: 'Foreign Policy',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:wkreszch2k4mumsrlkeaflgn',
    handle: 'france24.com',
    displayName: 'France 24 English',
    topics: ['politics'],
    regions: ['global', 'europe', 'france'],
    langs: ['en', 'fr'],
  },
  {
    did: 'did:plc:3qwgwrbtrvfb7wxshhnofwph',
    handle: 'alphaville.ft.com',
    displayName: 'FT Alphaville',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:5x3a6jke5p3ni7mnpd57ijhw',
    handle: 'globalvoices.org',
    displayName: 'Global Voices',
    topics: [],
    regions: ['global'],
    langs: [],
  },
  {
    did: 'did:plc:ngqdkvttdmzsbwb2mngquwip',
    handle: 'grist.org',
    displayName: 'Grist',
    topics: ['climate'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:nl32untxngcg74dl3w7scd74',
    handle: 'us.theguardian.com',
    displayName: 'Guardian US',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:zme3usssbyhtqtg2rsilkeh4',
    handle: 'insideclimatenews.org',
    displayName: 'Inside Climate News',
    topics: ['climate'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:rlihonu2dzw3ybtpajf53j5u',
    handle: 'lighthousereports.com',
    displayName: 'Lighthouse Reports',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:ayttzsapq4yt77n54alwdfpq',
    handle: 'medpagetoday.com',
    displayName: 'MedPage Today',
    topics: ['health'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:n6ntylxdpoo74zfscij4zpwr',
    handle: 'technologyreview.com',
    displayName: 'MIT Technology Review',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:nrepv6pvm5zcexreteqt4axg',
    handle: 'mongabay.com',
    displayName: 'Mongabay',
    topics: ['climate'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:qobvnkudcv3zlaklxxjduqoi',
    handle: 'motherjones.com',
    displayName: 'Mother Jones',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:546qgaw5whiyfktyiyzv4z3p',
    handle: 'newscientist.com',
    displayName: 'New Scientist',
    topics: ['science'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:omf7ijgofbpg6qdivyv7mio4',
    handle: 'nybooks.com',
    displayName: 'New York Review of Books',
    topics: ['politics', 'culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:ln72v57ivz2g46uqf4xxqiuh',
    handle: 'npr.org',
    displayName: 'NPR',
    topics: ['politics', 'culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:7ovywzofx3xxpn66s5r6vjm3',
    handle: 'opendemocracy.net',
    displayName: 'openDemocracy',
    topics: ['politics'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:bz2qt2eyn4wu5nnpqxu7iydz',
    handle: 'pitchfork.com',
    displayName: 'Pitchfork',
    topics: ['culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:yf6hctt2ug3qyfty4in64yob',
    handle: 'politico.com',
    displayName: 'Politico',
    topics: ['politics'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:k4jt6heuiamymgi46yeuxtpt',
    handle: 'propublica.org',
    displayName: 'ProPublica',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:hbdc3q6k5lforao5vyuarvsp',
    handle: 'restofworld.org',
    displayName: 'Rest of World',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:jbvnehrrdqoulco4rf5gxg5r',
    handle: 'reuters.com',
    displayName: 'Reuters',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:vvlpfarso2eojm2xpzc7qrd7',
    handle: 'rfi.fr',
    displayName: 'RFI',
    topics: ['politics'],
    regions: ['global', 'france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:vqgovau5gkirnk3ss5qwjdmz',
    handle: 'science.org',
    displayName: 'Science Magazine',
    topics: ['science'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2jwxoziacifmtqa5felhqms6',
    handle: 'semafor.com',
    displayName: 'Semafor',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:tshrll7hb5scyeg4m6nitxtr',
    handle: 'news.sky.com',
    displayName: 'Sky News',
    topics: ['politics'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:dawci6skpmelnlja3lygz3p7',
    handle: 'statnews.com',
    displayName: 'STAT News',
    topics: ['health'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:k3sjdodbk2cofbfzxucculeb',
    handle: 'techpolicypress.bsky.social',
    displayName: 'Tech Policy Press',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:vtpyqvwce4x6gpa5dcizqecy',
    handle: 'techcrunch.com',
    displayName: 'TechCrunch',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:b2kutgxqlltwc6lhs724cfwr',
    handle: 'theathletic.com',
    displayName: 'The Athletic',
    topics: ['sport'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:nyxviptfyic2lvuorkr5yy3y',
    handle: 'theatlantic.com',
    displayName: 'The Atlantic',
    topics: ['politics', 'culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:tcwxpp3qs5jlcmly4fdbxpx3',
    handle: 'theconversation.com',
    displayName: 'The Conversation',
    topics: ['politics'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:mhzk3blh4pfxo3fqh2meowbb',
    handle: 'economist.com',
    displayName: 'The Economist',
    topics: ['politics'],
    regions: ['global', 'europe', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:vovinwhtulbsx4mwfw26r5ni',
    handle: 'theguardian.com',
    displayName: 'The Guardian',
    topics: ['politics', 'culture'],
    regions: ['global', 'europe', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2zrav4rcsqjxswz6yxo45uiw',
    handle: 'theinformation.com',
    displayName: 'The Information',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:ypu6bwefbbzhcvojdj7mz657',
    handle: 'thelancet.com',
    displayName: 'The Lancet',
    topics: ['health'],
    regions: ['global', 'uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:eclio37ymobqex2ncko63h4r',
    handle: 'nytimes.com',
    displayName: 'The New York Times',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:t2dfq4ktezmwjdnjjaygw4bl',
    handle: 'newyorker.com',
    displayName: 'The New Yorker',
    topics: ['politics', 'culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:7exlcsle4mjfhu3wnhcgizz6',
    handle: 'theverge.com',
    displayName: 'The Verge',
    topics: ['tech'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:i3fhjvvkbmirhyu4aeihhrnv',
    handle: 'wsj.com',
    displayName: 'The Wall Street Journal',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:omofselcxdbcjhkc4235ygyl',
    handle: 'time.com',
    displayName: 'Time',
    topics: ['politics', 'culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:4ppjjgnfhrddmaanq6gvngp7',
    handle: 'undark.org',
    displayName: 'Undark',
    topics: ['science'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2yyvxfpy4s63ars26dzlpbf2',
    handle: 'usatoday.com',
    displayName: 'USA Today',
    topics: [],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:telglo5rrcxytqro5nqha3pt',
    handle: 'vox.com',
    displayName: 'Vox',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:sfvkd7mmhdpilq6zwiomisqe',
    handle: 'vulture.com',
    displayName: 'Vulture',
    topics: ['culture'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:k5nskatzhyxersjilvtnz4lh',
    handle: 'washingtonpost.com',
    displayName: 'Washington Post',
    topics: ['politics'],
    regions: ['global'],
    langs: ['en'],
  },
  {
    did: 'did:plc:inz4fkbbp7ms3ixufw6xuvdi',
    handle: 'wired.com',
    displayName: 'WIRED',
    topics: ['culture', 'tech'],
    regions: ['global'],
    langs: ['en'],
  },
  // europe
  {
    did: 'did:plc:g46lsajb4yjsxnpzut7al6cg',
    handle: 'brusselstimes.com',
    displayName: 'Brussels Times',
    topics: ['politics'],
    regions: ['europe', 'belgium'],
    langs: ['en'],
  },
  {
    did: 'did:plc:y76r3wcphgsa2tabzsrfdwgg',
    handle: 'standaard.be',
    displayName: 'De Standaard',
    topics: ['politics', 'culture'],
    regions: ['europe', 'belgium'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:ass4aukj7qniiiswynzx24xa',
    handle: 'volkskrant.nl',
    displayName: 'de Volkskrant',
    topics: ['politics', 'culture'],
    regions: ['europe', 'netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:6xofcnvvojjnmggqx43zghwh',
    handle: 'spiegel.de',
    displayName: 'Der Spiegel',
    topics: ['politics', 'culture'],
    regions: ['europe', 'germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:42pjb4dy3p3ubiekmwpkthen',
    handle: 'zeit.de',
    displayName: 'Die Zeit',
    topics: ['politics', 'culture'],
    regions: ['europe', 'germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:zsw7yua6jh627a5y4j4txnff',
    handle: 'elmundotoday.com',
    displayName: 'El Mundo Today',
    topics: ['politics'],
    regions: ['europe', 'spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:u6mkbcgviwlbhuwqirmhcgu3',
    handle: 'elpais.com',
    displayName: 'El País',
    topics: ['politics'],
    regions: ['europe', 'spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:npdxsw4zvih4gcyqppoql7qk',
    handle: 'euractiv.com',
    displayName: 'Euractiv',
    topics: ['politics'],
    regions: ['europe'],
    langs: ['en'],
  },
  {
    did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4',
    handle: 'lemonde.fr',
    displayName: 'Le Monde',
    topics: ['politics'],
    regions: ['europe', 'france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:q4q2hko2prboin62shrck5ix',
    handle: 'monde-diplomatique.fr',
    displayName: 'Le Monde Diplomatique',
    topics: ['politics'],
    regions: ['europe', 'france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:drxqcoxx5lgv2tue57fgnxcj',
    handle: 'lesoir.be',
    displayName: 'Le Soir',
    topics: ['politics', 'culture'],
    regions: ['europe', 'belgium'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:bvkk4kkuavnhqrwapc34wtfp',
    handle: 'nrc.nl',
    displayName: 'NRC',
    topics: ['politics', 'culture'],
    regions: ['europe', 'netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:bak7f4b3jsiqlpyo6o4ejaji',
    handle: 'politico.eu',
    displayName: 'POLITICO Europe',
    topics: ['politics'],
    regions: ['europe'],
    langs: ['en'],
  },
  {
    did: 'did:plc:xnmkjaouspdzqv4hzvvcf3j3',
    handle: 'euobserver.com',
    displayName: 'EUobserver',
    topics: ['politics'],
    regions: ['europe'],
    langs: ['en'],
  },
  {
    did: 'did:plc:klknudxgybzgrr4nkyjm2owg',
    handle: 'thetimes.com',
    displayName: 'The Times and Sunday Times',
    topics: ['politics'],
    regions: ['europe', 'uk'],
    langs: ['en'],
  },
  // belgium
  {
    did: 'did:plc:6oy7hvraackzt2fy7duur62q',
    handle: 'demorgen.be',
    displayName: 'De Morgen',
    topics: ['politics', 'culture'],
    regions: ['belgium'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:tn6v3sxnszbm37msd5kyeqki',
    handle: 'tijd.be',
    displayName: 'De Tijd',
    topics: ['politics'],
    regions: ['belgium'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:74lezito7fe4crvzxqaxlb4w',
    handle: 'hln.be',
    displayName: 'Het Laatste Nieuws',
    topics: [],
    regions: ['belgium'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:3eqiobea3kpknblyifns2erm',
    handle: 'knack.be',
    displayName: 'Knack',
    topics: ['politics'],
    regions: ['belgium'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:e6dbovlsokffoxeo7pdnzkap',
    handle: 'lalibre.be',
    displayName: 'La Libre Belgique',
    topics: ['politics'],
    regions: ['belgium'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:qc4mcscqvjucmhpk76oonop5',
    handle: 'rtbf.be',
    displayName: 'RTBF Info',
    topics: ['politics'],
    regions: ['belgium'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:rzjix5b5fwl3lhbxccsb5m5u',
    handle: 'vrtnws.be',
    displayName: 'VRT NWS',
    topics: ['politics'],
    regions: ['belgium'],
    langs: ['nl'],
  },
  // france
  {
    did: 'did:plc:kfsaqdm4624tghuu4nydph2i',
    handle: '01net.com',
    displayName: '01net',
    topics: ['tech'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:wb4ovhhcrif6cp66oe2pqx7i',
    handle: 'bfmtv.com',
    displayName: 'BFMTV',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:vm2tsoixg7vsygrolxd4rrho',
    handle: 'charliehebdo.fr',
    displayName: 'Charlie Hebdo',
    topics: ['politics', 'culture'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:vb7d3zz6khc7zqcg7743eqiq',
    handle: 'franceinfo.fr',
    displayName: 'Franceinfo',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:vbhvpqudswo72vskdfr34idm',
    handle: 'frandroid.com',
    displayName: 'Frandroid',
    topics: ['tech'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:fpambcnvhstbckgv23fh7rem',
    handle: 'lexpress.fr',
    displayName: "L'Express",
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:xhye77kvlv7vddwpapebsljj',
    handle: 'nouvelobs.com',
    displayName: "L'Obs",
    topics: ['politics', 'culture'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:lv3e3gevfzmjvjcauffv4sjp',
    handle: 'la-croix.com',
    displayName: 'La Croix',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:znu3bmhx5mx2icucilix5rpa',
    handle: 'lefigaro.fr',
    displayName: 'Le Figaro',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:anpfslmr5xhyw7oqzai3dprd',
    handle: 'leparisien.fr',
    displayName: 'Le Parisien',
    topics: [],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:aixwsdaeubfrxedelxe7rqwq',
    handle: 'lepoint.fr',
    displayName: 'Le Point',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:tuwg4bd73p5m7jrrmjhl2jix',
    handle: 'lesechosfr.bsky.social',
    displayName: 'Les Echos',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:uo4didwt5qe4onrscbmqwvwm',
    handle: 'liberation.fr',
    displayName: 'Libération',
    topics: ['politics', 'culture'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:2egpzsea27fru2vkrjgdw2ob',
    handle: 'mediapart.fr',
    displayName: 'Mediapart',
    topics: ['politics'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:kc53xgnevbecrg7xaimmfexh',
    handle: 'numerama.com',
    displayName: 'Numerama',
    topics: ['tech'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:p7gdpofkiswapwrhfos7nqqd',
    handle: 'ouest-france.fr',
    displayName: 'Ouest-France',
    topics: [],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:2htr6vzopp6mejep7qcpszru',
    handle: 'reporterre.net',
    displayName: 'Reporterre',
    topics: ['climate'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:rc2vahjsltfy2fkaqyxpzkul',
    handle: 'sofoot.com',
    displayName: 'So Foot',
    topics: ['sport'],
    regions: ['france'],
    langs: ['fr'],
  },
  {
    did: 'did:plc:qtupmmogj72y37n7pl4u736w',
    handle: 'sudouest.fr',
    displayName: 'Sud Ouest',
    topics: [],
    regions: ['france'],
    langs: ['fr'],
  },
  // germany
  {
    did: 'did:plc:oalaoatxe7hlkqbz7kt2e3qm',
    handle: 'freitag.de',
    displayName: 'Der Freitag',
    topics: ['politics', 'culture'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:zv657bpskxtjkvbdd5wymjam',
    handle: 'heise.de',
    displayName: 'Heise Online',
    topics: ['tech'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:fbs7q5ymtsv6kbokagsk6dan',
    handle: 'kicker.de',
    displayName: 'Kicker',
    topics: ['sport'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:46gspxu3aehikdcmmegutcxd',
    handle: 'ndr.de',
    displayName: 'NDR',
    topics: [],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:bd2ad25frux6jav66chr6aiw',
    handle: 'netzpolitik.org',
    displayName: 'netzpolitik.org',
    topics: ['politics', 'tech'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:fraeyszjcz6qjjksrkct7mpr',
    handle: 'stern.de',
    displayName: 'Stern',
    topics: ['politics'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:j3ri5rsnbzbq7gfphl2jka2c',
    handle: 't3n.de',
    displayName: 't3n',
    topics: ['tech'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:ulwdhcuhr3ujocgxgrsi6kca',
    handle: 'tagesspiegel.de',
    displayName: 'Tagesspiegel',
    topics: ['politics'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:zorx72vm56gtgv4hzl66q4zm',
    handle: 'taz.de',
    displayName: 'TAZ',
    topics: ['politics', 'culture'],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:zx3fea4j6a4m5ior3332q2l5',
    handle: 'uebermedien.de',
    displayName: 'Übermedien',
    topics: [],
    regions: ['germany'],
    langs: ['de'],
  },
  {
    did: 'did:plc:lwsmic4fvtzizgyujtgczkgv',
    handle: 'verfassungsblog.de',
    displayName: 'Verfassungsblog',
    topics: ['politics'],
    regions: ['germany'],
    langs: ['de'],
  },
  // netherlands
  {
    did: 'did:plc:7fq77ywjddp4kaju2gklzi77',
    handle: 'ad.nl',
    displayName: 'AD',
    topics: [],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:afrq5upux4xh2o5psosn6rnv',
    handle: 'at5.nl',
    displayName: 'AT5',
    topics: [],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:le3qtd7rmw3hzqrigwve7ocx',
    handle: 'bnr.nl',
    displayName: 'BNR Nieuwsradio',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:u7gjifeh4gxmompxjrugvunu',
    handle: 'decorrespondent.nl',
    displayName: 'De Correspondent',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:xpftwxnjd6qa4c72i2grsch5',
    handle: 'groene.nl',
    displayName: 'De Groene Amsterdammer',
    topics: ['politics', 'culture'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:v2th7wjz4ct3wydmeolnsapz',
    handle: 'telegraaf.nl',
    displayName: 'De Telegraaf',
    topics: [],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:zrqb66snqhomf2tvh3l5czmi',
    handle: 'ftm.nl',
    displayName: 'Follow the Money',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:tqjrudm27xy2qovgwlives4s',
    handle: 'fd.nl',
    displayName: 'Het Financieele Dagblad',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:7jhjmjekhzpmk6cvnbtornz5',
    handle: 'parool.nl',
    displayName: 'Het Parool',
    topics: [],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:5b4u3uwhlcj4f2f6gvflcrce',
    handle: 'nieuwsuur.nl',
    displayName: 'Nieuwsuur',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:f43ryzeuv5o5ob5pf7u34ztt',
    handle: 'nu.nl',
    displayName: 'NU.nl',
    topics: [],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:zysbwg6enjz6hatjrdye6wuo',
    handle: 'trouw.nl',
    displayName: 'Trouw',
    topics: ['politics'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:r74rn6trtpqwfn62qid7e7nl',
    handle: 'tweakers.net',
    displayName: 'Tweakers',
    topics: ['tech'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  {
    did: 'did:plc:j6333oww6ixrxlbb4fsfyzeq',
    handle: 'vn.nl',
    displayName: 'Vrij Nederland',
    topics: ['politics', 'culture'],
    regions: ['netherlands'],
    langs: ['nl'],
  },
  // spain
  {
    did: 'did:plc:7zw6euiay4tdf7mphq2opnks',
    handle: '20minutos.es',
    displayName: '20Minutos',
    topics: [],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:j22lmfbgns43aqcy5rzhavx3',
    handle: 'abc.es',
    displayName: 'ABC',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:ntbkjzkatqtw4p2ngfkvm7ov',
    handle: 'ara.cat',
    displayName: 'ARA',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['ca'],
  },
  {
    did: 'did:plc:vwc3u2sqfxdykd2m6qu3p74b',
    handle: 'as.com',
    displayName: 'AS',
    topics: ['sport'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:cgtt2xmdufwgh6msvt7vvpg2',
    handle: 'cadenaser.com',
    displayName: 'Cadena SER',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:nfgjiprpvndz2zzl2as3zp2d',
    handle: 'ctxt.es',
    displayName: 'Ctxt',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:nwkkuivtcwljhotpkj52xsu5',
    handle: 'elespanol.com',
    displayName: 'El Español',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:kz7u7qx5zzgatcd2rsq6crac',
    handle: 'elperiodico.com',
    displayName: 'El Periódico',
    topics: [],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:sv2ivxvf7fxchmo2xamo3wwx',
    handle: 'eldiario.es',
    displayName: 'eldiario.es',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:ma7n4u3bhcyc5bznvk7fsgkh',
    handle: 'lavanguardia.com',
    displayName: 'La Vanguardia',
    topics: ['politics', 'culture'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:7qf5kjqpgcsqqrf52fwa7xcx',
    handle: 'ondacero.es',
    displayName: 'Onda Cero',
    topics: [],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:obruk6nipsroeivgkqwpowgt',
    handle: 'publico.es',
    displayName: 'Público',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:6mocxy76qhlrhhp3t7ltkbqf',
    handle: 'sport.es',
    displayName: 'SPORT',
    topics: ['sport'],
    regions: ['spain'],
    langs: ['es'],
  },
  {
    did: 'did:plc:reloczc52dp4zqwymggpepoz',
    handle: 'vilaweb.cat',
    displayName: 'VilaWeb',
    topics: ['politics'],
    regions: ['spain'],
    langs: ['ca'],
  },
  // uk
  {
    did: 'did:plc:ym6a73dx7kibs6fksyuzewem',
    handle: 'bbcnewsnight.bsky.social',
    displayName: 'BBC Newsnight',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:euezu3e2jurm5spgr35f2a7u',
    handle: 'bbcsounds.bsky.social',
    displayName: 'BBC Sounds',
    topics: ['culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:qiz5bd6ierfiykcuvzmjaj4e',
    handle: 'bylinetimes.bsky.social',
    displayName: 'Byline Times',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:572hutetu6rfcrof4jyzm6xi',
    handle: 'channel4news.bsky.social',
    displayName: 'Channel 4 News',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:mzeafnu2fiz4jsuohywamioa',
    handle: 'dailymail.co.uk',
    displayName: 'Daily Mail',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:shxqhlplcrwpegumqqltpvzz',
    handle: 'mirror.co.uk',
    displayName: 'Daily Mirror',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:33wdmcwpkvsckk4sqcnsav42',
    handle: 'eurogamer.bsky.social',
    displayName: 'Eurogamer',
    topics: ['culture', 'tech'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:otarcwleqi3jxsawymestdeg',
    handle: 'hsj.co.uk',
    displayName: 'Health Service Journal',
    topics: ['health'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:zd2xrecgi2uwl2q44op2rani',
    handle: 'itvnews.bsky.social',
    displayName: 'ITV News',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:lwmiyyhcs43mpjjuqppu4cfq',
    handle: 'lbc.co.uk',
    displayName: 'LBC News',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:3cgh6tdhxnnih4axrgy57cyz',
    handle: 'liverpoolecho.co.uk',
    displayName: 'Liverpool Echo',
    topics: ['sport'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:63zjpqfhowjsbfl26dipg3e2',
    handle: 'lrb.co.uk',
    displayName: 'LRB (London Review of Books)',
    topics: ['politics', 'culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:jo37bwbi4dkt4ce6dckcqcjx',
    handle: 'manchestereveningnews.co.uk',
    displayName: 'Manchester Evening News',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:sdpon5ex2jtxg4b7wqp3xtv6',
    handle: 'metro.co.uk',
    displayName: 'Metro UK',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:s55iys3p4tup2yzz7q7ddjj3',
    handle: 'newstatesman1913.bsky.social',
    displayName: 'New Statesman',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:o62es4jcsgabgaswnjuvrbjm',
    handle: 'nujofficial.bsky.social',
    displayName: 'NUJ',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:m44am22qggkwh6xqvddql3ss',
    handle: 'pressgazette.co.uk',
    displayName: 'Press Gazette',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:2lbg7npnbv2fjgeroontnvas',
    handle: 'privateeyenews.bsky.social',
    displayName: 'Private Eye',
    topics: ['politics', 'culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:cn6pb5ywkbtqicg4drteegjr',
    handle: 'prospectmagazine.co.uk',
    displayName: 'Prospect',
    topics: ['politics', 'culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:ldpm7rbssri7q63rujlfcsna',
    handle: 'talksport.com',
    displayName: 'talkSPORT',
    topics: ['sport'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:g2syplhduvniqojxe2qpc4uh',
    handle: 'uk.theconversation.com',
    displayName: 'The Conversation UK',
    topics: [],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:nu2dnq6t4q6hpifmdnrjhm4v',
    handle: 'thefence.bsky.social',
    displayName: 'The Fence',
    topics: ['politics', 'culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:qyxzjrsbv5tbiywsg2mgkdjs',
    handle: 'theferret.scot',
    displayName: 'The Ferret',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:4sqb5ugga4lhhrkkuw2sa5oi',
    handle: 'theipaper.com',
    displayName: 'The i',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:yc54nj2zlnqrdotewpkbrauy',
    handle: 'the-independent.com',
    displayName: 'The Independent',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:bz67dxqh5nmjl5it36xylqyy',
    handle: 'theregister.com',
    displayName: 'The Register',
    topics: ['tech'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:rer7bi5nn2yvvsnlaiiwin2k',
    handle: 'telegraph.co.uk',
    displayName: 'The Telegraph',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:dh6kpxgui4whoahqyhc4lzb2',
    handle: 'timeout.com',
    displayName: 'Time Out London',
    topics: ['culture'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:itf3eviftt7nis4q27cnjqwz',
    handle: 'tortoisemedia.bsky.social',
    displayName: 'Tortoise Media',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
  {
    did: 'did:plc:us655ytwdg3kp5yg5b4cqfk4',
    handle: 'ukparliament.parliament.uk',
    displayName: 'UK Parliament',
    topics: ['politics'],
    regions: ['uk'],
    langs: ['en'],
  },
]

/**
 * Filter the registry by a selection. Empty `topics`/`regions`/`languages`
 * mean "no constraint" on that facet, and so does `ALL_TOPICS` among the
 * topics. Pass `applyExclusions: false` to get the full
 * match set for the opt-out screen, where the user toggles sources off.
 */
export function selectSources(
  selection: {
    topics: string[]
    regions: string[]
    languages?: string[]
    excludedDids?: string[]
  },
  {applyExclusions = true}: {applyExclusions?: boolean} = {},
): NewsSource[] {
  const {topics, languages = [], excludedDids = []} = selection
  const regions = withParents(selection.regions)
  const filterByTopic = topics.length > 0 && !topics.includes(ALL_TOPICS)
  return NEWS_SOURCES.filter(source => {
    if (filterByTopic && !topics.some(t => source.topics.includes(t))) {
      return false
    }
    if (regions.length && !regions.some(r => source.regions.includes(r))) {
      return false
    }
    if (languages.length && !languages.some(l => source.langs.includes(l))) {
      return false
    }
    if (applyExclusions && excludedDids.includes(source.did)) {
      return false
    }
    return true
  })
}

const REGION_PARENTS = new Map(
  NEWS_REGIONS.flatMap(r => (r.parent ? [[r.id, r.parent] as const] : [])),
)

/** The regions, plus the country of any province among them. */
function withParents(regions: string[]): string[] {
  return [
    ...new Set(
      regions.flatMap(id => {
        const parent = REGION_PARENTS.get(id)
        return parent ? [id, parent] : [id]
      }),
    ),
  ]
}

const REGION_LABELS = new Map(NEWS_REGIONS.map(r => [r.id, r.label]))
/**
 * Labels for a source's tags, regions first, then topics, for the source card.
 * Topics are the news aggregator's themes, so their names come from it.
 */
export function sourceTagLabels(
  source: NewsSource,
  themeName: (slug: string) => string,
): string[] {
  return [
    ...source.regions.map(id => REGION_LABELS.get(id) ?? id),
    ...source.topics.map(themeName),
  ]
}
