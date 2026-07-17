/**
 * The registry of approved publishers. Each publisher owns a page at
 * `/newsroom/:didOrHandle` that blends its editorial posts, its reporters'
 * posts, and (later) external sources like RSS, podcasts, and YouTube.
 *
 * This is shared, operator-owned config rather than per-user state, so it lives
 * as a local list instead of in the PDS. There is no per-user newsroom state
 * for now: every registered newsroom is equally visible to everyone.
 */

/**
 * A content source feeding a publisher's page beyond its Bluesky account
 * (which is registry-level: `did` + `reporterDids`). Only RSS is consumed
 * today; podcast and YouTube adapters are roadmap and will extend this union
 * when they exist.
 */
export type NewsroomSource = {type: 'rss'; url: string}

export interface NewsroomPublisher {
  /** Stable id; may end up in per-user records later, so never reuse or renumber. */
  id: string
  /** The publisher's own Bluesky account; its posts are the editorial "desks". */
  did: string
  /** Per-publisher brand accent, tinting the follow button and share CTA. */
  accent?: string
  /** Category filter chips, e.g. Politics, World, Economy, Culture. */
  categories: string[]
  /** Accounts surfaced in the "Reporters" rail / merged feed. */
  reporterDids: string[]
  /** Additional content sources beyond the publisher account. */
  sources: NewsroomSource[]
}

export const NEWSROOM_PUBLISHERS: NewsroomPublisher[] = [
  {
    id: 'financial-times',
    did: 'did:plc:5u54z2qgkq43dh2nzwzdbbhb',
    // FT claret; the avatar salmon is too light for a button.
    accent: '#990F3D',
    categories: ['Finance', 'Economy', 'Markets', 'World'],
    reporterDids: [
      'did:plc:ul3dm3b76hu2cqla3qxb4v6u', // FT Visual & Data Journalism
      'did:plc:ho34pe25d3ywc6g6vxugre2i', // John Burn-Murdoch
      'did:plc:vctygadtgwki2c3jtd7mnrna', // Robert Smith
      'did:plc:ovcqkwjayo3lwjbzpupi5rkx', // Josh Spero
      'did:plc:xbzge44ocelaiqhwia6sns3l', // Ian Smith
      'did:plc:bo2iacbu4r2t326ohyljzjff', // Joel Suss
      'did:plc:jvbiziwb7bwc3w2o4a37kjvc', // Henry Foy
      'did:plc:wn4udtenp73qhwzplj5w74cz', // Kenza Bryan
      'did:plc:ndxytmklghrlftxliqrtlrsm', // Emma Lewis
      'did:plc:pwomb4sdj367nitwfzo3vzb3', // Rafe Uddin
      'did:plc:fybvykhvudrerlnjpodxu7k3', // Lee Harris
      'did:plc:tzo7yntprvgimgf26cu2tugt', // Arash Massoudi
      'did:plc:wu4mjofhuhhkrpx2sg5j7237', // Antonia Cundy
      'did:plc:hakd5on4aiwv2o436lwew2yr', // Eric Platt
      'did:plc:ouxzn7j76orvrzrnck2ebquy', // Chris Allnutt
      'did:plc:gliqwsgeysrpbllgzvrqfrfc', // Stephanie Stacey
    ],
    sources: [{type: 'rss', url: 'https://www.ft.com/rss/home/international'}],
  },
  {
    id: 'the-verge',
    did: 'did:plc:7exlcsle4mjfhu3wnhcgizz6',
    accent: '#5200FD',
    categories: ['Tech', 'Science', 'Culture'],
    reporterDids: [
      'did:plc:x56l2n7i7babgdzqul4bd433', // nilay patel
      'did:plc:j3tpb4iabrq3ukfaui6eymwf', // Elizabeth Lopatto
      'did:plc:4t2ziwnnescprzorvmrfduey', // sarah jeong
      'did:plc:fbtvg6jxtdroidfvq5z635xu', // Tom Warren
      'did:plc:fctau3eedws5cdrvnv4k6n2q', // Mia Sato
      'did:plc:s5xvwzyhy352e3yguorxm53o', // Jay Peters
      'did:plc:ilnij47llo5n3rghg3xwofbd', // Richard Lawler
      'did:plc:nrgrfq7v6jph3tgh2pakcohc', // Justine Calma
      'did:plc:ylxn6kagok5e24tg4gvvngyh', // Lauren Feiner
      'did:plc:7aabooyqkx6gj7wqb3feieop', // Charles Pulliam-Moore
      'did:plc:kgsntpdacws3ruplcv5oxex4', // Tina Nguyen
      'did:plc:eqi5g7hig3wnj4wrn7hknnph', // Nathan Edwards
    ],
    sources: [{type: 'rss', url: 'https://www.theverge.com/rss/index.xml'}],
  },
  {
    id: 'wired',
    did: 'did:plc:inz4fkbbp7ms3ixufw6xuvdi',
    categories: ['Tech', 'Security', 'Science', 'Culture'],
    reporterDids: [
      'did:plc:5vzgjins5recitzoov4rby3y', // Andrew Couts
      'did:plc:vaznsq6z7zughxjapim2nazy', // Vittoria Elliott
      'did:plc:o4pdps2jkn7uhrdgadni7djk', // dell cameron
      'did:plc:cfy5rgqvohpdqxgu2geb5u2b', // Miles Klee 🦉
      'did:plc:ywaw2j45ezffsoe3ig7yfzni', // Hugo Lowell
      'did:plc:xciroqs5w2kazs6fc6ypcbh7', // Tim Marchman
      'did:plc:dus2ftflcqjg6joeuw46sz5g', // David Gilbert
      'did:plc:2vbxpb3b5ussxlij3pu6seke', // molly taft
      'did:plc:bp7gpg52wwxhhgrwoqcni3l5', // Kate Knibbs
      'did:plc:zbxq6fbw575t4nakfot3epen', // Andy Greenberg
      'did:plc:zmmjzwjmlwaiayezbda5fboj', // Dhruv Mehrotra
    ],
    sources: [{type: 'rss', url: 'https://www.wired.com/feed/rss'}],
  },
  {
    id: 'new-york-times',
    did: 'did:plc:eclio37ymobqex2ncko63h4r',
    categories: ['World', 'Politics', 'Business', 'Culture'],
    reporterDids: [
      'did:plc:zeqq4z7aybrqg6go6vx6lzwt', // Dylan Freedman
      'did:plc:fhjbtko7kiyerpsehvdpnygi', // amanda hess
      'did:plc:emhyi4kljodgqlusdsopgfgd', // Ryan Mac 🙃
      'did:plc:kydd7ppawtffeqfvek5omiz4', // Ida Bae Wells
      'did:plc:tktyhvgeo3nqluw4wpdjzqgo', // Ben Casselman
      'did:plc:r447s5lk6pkqa2odupiacasu', // Alissa Wilkinson
      'did:plc:xs5kossjbra2o6rxa42cjpnv', // David Enrich
      'did:plc:qu5u32mm3vetl7hxtdktb4za', // Malachy Browne
      'did:plc:nl2p6ivi62ts5gudgj2pql5v', // Ruth Graham
      'did:plc:67xyrc6drzo2qzke7irbk32y', // Mike Madden
      'did:plc:wzzo43pjne7o7irlimljpmow', // David Fahrenthold
      'did:plc:3qpjxt7lez7zvigx4cwxmrry', // The Upshot
      'did:plc:m6wnty4blodpxctitmdikmxr', // Sapna Maheshwari
      'did:plc:nakz2fndgfjyoeyxexdvttbd', // Jessica Silver-Greenberg
      'did:plc:ls26zjpubpydja6dgqitbifq', // Margot Sanger-Katz
      'did:plc:ebdqryrjwg33xx2fnjvpscqi', // Harry Stevens
      'did:plc:dfyvadpfqliks77dxk7ewb6c', // Sheryl Gay Stolberg
      'did:plc:rwsmbu6y2koy2nuaht7tamdp', // Aimee Ortiz
      'did:plc:r3lb3j3sqfdgdyjyybhigoyb', // John Ismay
    ],
    sources: [
      {
        type: 'rss',
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      },
    ],
  },
  {
    id: 'euractiv',
    did: 'did:plc:npdxsw4zvih4gcyqppoql7qk',
    accent: '#637D8A',
    categories: ['EU', 'Politics', 'Policy'],
    reporterDids: [
      'did:plc:7eh3lqtbqishy6j23ysgf2p6', // Elisa Braun
      'did:plc:y3ymihvjpvubhdpfnqv55new', // Maximilian Henning
      'did:plc:zp2o64h3jlcsw6up4ho75p74', // Théophane Hartmann
      'did:plc:66qckp4ns5ad2juucv7pxfl2', // Nikolaus J. Kurmayer
      'did:plc:jexhybwmuma7dmwpk4l6okom', // Cristina Maza
      'did:plc:zoo6adzdslnmcyk27tlmn3x6', // Nicoletta Ionta
      'did:plc:ge2rpx4uunvnyzhkn6bhvuog', // Magnus Lund Nielsen
      'did:plc:2v3slkmmwimczhtu4trbxmbp', // Stefano Porciello
      'did:plc:6mckyc635pesriatn2jr2apy', // Emma Pirnay
      'did:plc:wx65cxoracvjifldm7as4n7w', // Sofia Sanchez Manzanaro
      'did:plc:e4nx5cuyztlqz3cwcbgzabzz', // Eddy Wax
    ],
    // Cloudflare challenges non-browser fetches of this feed today; the page
    // degrades to the conversation until it is reachable.
    sources: [{type: 'rss', url: 'https://www.euractiv.com/?feed=mcfeed'}],
  },
  {
    id: '404-media',
    did: 'did:plc:vcepp6trx4vpe5ourxso4tjl',
    accent: '#16A34A',
    categories: ['Technology', 'Privacy', 'Policy'],
    reporterDids: [
      'did:plc:cjfcz3t36f6nrprarkhkycxo', // Jason Koebler
      'did:plc:vk7rduhvom3rq6dyluce5wzf', // Joseph Cox
      'did:plc:pt47oe625rv5cnrkgvntwbiq', // Sam Cole
      'did:plc:fz7vvi4dlckgnon26xinmkch', // Emanuel Maiberg
    ],
    sources: [{type: 'rss', url: 'https://www.404media.co/rss/'}],
  },
  {
    id: 'cnn',
    did: 'did:plc:dzezcmpb3fhcpns4n4xm4ur5',
    accent: '#CD0001',
    categories: ['World', 'Politics', 'US'],
    reporterDids: [
      'did:plc:obbbrxcdhty5lw2a2v3zmdiw', // Natasha Bertrand
      'did:plc:kpiyzopccrnnfddrz5ule6an', // Andrew Freedman
      'did:plc:gy4wutrtfae3n2arpqcesmk4', // Hannah Keyser
      'did:plc:hcn5qmsrdmaiubq36lgy7ptm', // Avery Schmitz
      'did:plc:5sbnndc7skkdqopwjxndz5d3', // Miriam Elder
      'did:plc:rxdfxb35aabfvjip7vrvcflj', // Katie Polglase
      'did:plc:q63todm6s74ykwdxspn7nkyh', // Josh Campbell
      'did:plc:f3on3rhndp4dn2ijahfrgiq6', // Dakota Smith
      'did:plc:krqenpph6og22jcprq2bhwlv', // Gianluca Mezzofiore
      'did:plc:3qbdrboerihasyf2igkz2uvi', // Ella Nilsen
    ],
    sources: [{type: 'rss', url: 'http://rss.cnn.com/rss/cnn_topstories.rss'}],
  },
  {
    id: 'nrc',
    did: 'did:plc:bvkk4kkuavnhqrwapc34wtfp',
    accent: '#D40811',
    categories: ['Netherlands', 'World', 'Politics'],
    reporterDids: [
      'did:plc:6ep35we6vxdraitsbysctcdc', // Marloes de Koning
    ],
    sources: [{type: 'rss', url: 'https://www.nrc.nl/rss/'}],
  },
  {
    id: 'propublica',
    did: 'did:plc:k4jt6heuiamymgi46yeuxtpt',
    categories: ['Investigations', 'Politics', 'Justice'],
    reporterDids: [
      'did:plc:sblju4a66qwthmosnm4m7k4e', // Charles Ornstein
      'did:plc:ny4yaltimarkgs4fgnsarfhy', // Justin Elliott
      'did:plc:o4h5r2albulagzxvhp634tof', // Eric Umansky
      'did:plc:mdkpuqr6oevfy3igtp35ostl', // Anna Clark
      'did:plc:7sfqvvcpwyzjrai4xuz5xj7h', // Chris Morran
      'did:plc:pgr2z6hxsr2ynubld4kct6xg', // Annie Waldman
      'did:plc:jjo65c3eijoqao7ri3vkmt22', // Josh Kaplan
      'did:plc:ix26ab37ugxyhgpunrmzdh5g', // Nicole Foy
      'did:plc:dvca3ibsumgs5k2hwm6ffjl6', // Tracy Jan
      'did:plc:zllcf64tjwab5cdyntm56rnx', // Molly Redden
      'did:plc:vmoxwmv6edwb6gp6iiu4rwut', // Melissa Sanchez
    ],
    sources: [
      {type: 'rss', url: 'https://www.propublica.org/feeds/propublica/main'},
    ],
  },
  {
    id: 'euobserver',
    did: 'did:plc:xnmkjaouspdzqv4hzvvcf3j3',
    accent: '#EF513B',
    categories: ['EU', 'Politics', 'Green Economy', 'Migration', 'Digital'],
    reporterDids: [
      'did:plc:gswts63m3ew4kbrlwt7a5ika', // Elena Sánchez Nicolás
      'did:plc:epzn6awph6unnn6mhme2vn7o', // Alejandro Tauber
      'did:plc:2djedbaopsrmwlb7gcgx3wz6', // Nikolaj Nielsen
    ],
    sources: [{type: 'rss', url: 'https://euobserver.com/feed/'}],
  },
  {
    id: 'the-guardian',
    did: 'did:plc:vovinwhtulbsx4mwfw26r5ni',
    accent: '#052962',
    categories: ['Europe', 'World', 'Politics', 'Culture'],
    reporterDids: [
      'did:plc:6yde3jzbwuuxqmp2ibtrbo3e', // Julia Carrie Wong
      'did:plc:spaeihzrxlximgheyhcakqpd', // Heather Stewart
      'did:plc:eypx7dodaoitos4rbv5ihks3', // Jessica Elgot
      'did:plc:fondzonhxhlrfp777gwvfmah', // Peter Walker
      'did:plc:6ht5cj2lcw3kt7effuil5ppp', // Tom Phillips
      'did:plc:5qwwganvs25qewz3efms76t4', // Michael Savage
      'did:plc:qy6ncvhegjm536fogv7wnbrs', // Eleni Courea
      'did:plc:bpzpp27d3qa7d6cnn6lvubsd', // Hannah Jane Parkinson
      'did:plc:ngoxtcqfsu6l5wx4opmmsolz', // Jeff Rueter
      'did:plc:uequhtdwqt6aaheix4vttkf7', // Dara Kerr
    ],
    sources: [{type: 'rss', url: 'https://www.theguardian.com/europe/rss'}],
  },
  {
    id: 'le-monde',
    did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4',
    categories: ['France', 'World', 'Politics'],
    reporterDids: [
      'did:plc:b3zr2ychdb2pzfkb2zxitpzl', // Faustine Vincent
      'did:plc:v647kgllvlqkaufpaiouz5mh', // Martin Untersinger
      'did:plc:ug64elynwv5wsbg6cgr75hc3', // Pixels | Le Monde
      'did:plc:qfpamyffwldumcforfvtmqmu', // Corentin Lamy
      'did:plc:f72667wgz6dwtiz3ygkz7m5x', // Samuel Laurent
      'did:plc:mgsd4sw4nfxjbrhxeecohrxa', // Stéphane Foucart
      'did:plc:x7sjciuz4ih2kwox6caobtjl', // Michaël Szadkowski ☑️
      'did:plc:vllmdesexl2hlzptjde2mxni', // Olivier Laffargue
      'did:plc:spw6vjpw7q74zhtul3i3kevg', // 🏔Léa Bello
      'did:plc:xvkuabfumn4gbgta3qufnar2', // Assma Maad
      'did:plc:k4moqf4ybcyzb2vjkbkpfcl6', // Olivier Clairouin
      'did:plc:2hmfrwu63eglxypel6khgwrm', // Sylvia Zappi
      'did:plc:yjqu3rartwqm5crh25kc6x4w', // Anne-Françoise Hivert
      'did:plc:f7ghzf2miz7byhxmd7ii7tkn', // Pierre Breteau
      'did:plc:aukhvy3udoenmpenjluzmgbw', // Gary Dagorn
      'did:plc:w73avkmoz3aaqpjkyxzvhdyu', // Alexandre HORN
      'did:plc:dszjerlrcmpisu3zvrpnf2vw', // Véronique Chocron
      'did:plc:wf65rjlylgi54u3eknyu2fby', // Pauline Croquet
      'did:plc:fqyhumbgskta3gqidojnyk6w', // Fabien Leboucq
      'did:plc:wj6csvqr3hchz42fn6dnwoxj', // Marion Dupont
      'did:plc:hbmxsyi625hnsthfajahlbi3', // Marie Slavicek
      'did:plc:y7ersyokcxod5vmhq7tjxsd3', // Xemartin Laborde
      'did:plc:535hpcjsimunihruhgnij7on', // Angeline Montoya
      'did:plc:jsig5zpnvhrtayu6leg65s6j', // Julien Muguet
      'did:plc:s4tuye3da4rquyizeetukyyd', // Coline Folliot
      'did:plc:tyivnkwzbsup6p67ypkcm7ub', // JB Chastand
      'did:plc:v5ragdanllg5ajj3hwhfduq2', // Léa Girardot
      'did:plc:54vzmluahce2cen3ftc5wjly', // Romain Geoffroy
      'did:plc:s5km2ngp6v5j6ile2xuxcppr', // Jules Thomas
      'did:plc:ycxjqllqbzgnl3luteoi3ztj', // Marion Huysman
      'did:plc:ou7pko4co6rv5vpgwdgqjyy6', // Sylvie Lecherbonnier
      'did:plc:vnjz6in3nhtxgr6wrh3bmjuy', // Guillaume Daudin
      'did:plc:jj2odlb2olplj4zq45ypfara', // Benjamin Roger
      'did:plc:wx3z426xjwgcva2vebvbmy4w', // Eric Albert
      'did:plc:kzsxflujxsbe5vclr7y5iktv', // Liselotte Mas
      'did:plc:s3gxpnre6hvvcqplxczy2swr', // Éléa Pommiers
      'did:plc:7xkngyk676snmufkmp7ragn5', // Clément Martel
      'did:plc:cbyq2vksea2sd4kuzlnvhwaz', // Madjid Zerrouky
      'did:plc:rx3eoh3ens46uoqlamoldtdj', // Asia Balluffier
      'did:plc:ixozswfomqjikso2ohcwftmq', // Cécile Boutelet
    ],
    sources: [{type: 'rss', url: 'https://www.lemonde.fr/rss/une.xml'}],
  },
  {
    id: 'el-pais',
    did: 'did:plc:u6mkbcgviwlbhuwqirmhcgu3',
    accent: '#0067A0',
    categories: ['Spain', 'World', 'Politics'],
    reporterDids: [
      'did:plc:ztguhtmgiyqr6lrh6ttnvvci', // Javier Salas
      'did:plc:at3ruvkdrarcofuuu2guqekn', // Ricardo de Querol
      'did:plc:ak4w4q2xdznbsygxpbrwlnte', // Belén Remacha
      'did:plc:ql5yfwupfj5vttxcu5atxxlg', // Valdés
      'did:plc:hxsbtsm72qd4n3efvmmvz7mk', // Nacho Fariza S.
      'did:plc:vfk6lpa6hryf3dcutb325vge', // Miguel Ángel Medina
      'did:plc:t3mbs5hd7xb5634qqxxi3dxc', // Martín Bianchi Tasso
      'did:plc:lhdme2w5akkxcsts4k6u5tg3', // Soledad Alcaide
      'did:plc:44ukbk6jb2jm4p6rwemerm44', // Natalia Marcos
      'did:plc:sze5amt5bvh2tovielons4mo', // Macarena Vidal
    ],
    sources: [
      {
        type: 'rss',
        url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
      },
    ],
  },
  {
    id: 'next',
    did: 'did:plc:o4gygiehiqr7hcpyicprn6w4',
    accent: '#4A5CFE',
    categories: ['Tech', 'Digital Policy', 'Privacy'],
    reporterDids: [
      'did:plc:56lvkl2sub3gvojlzknbwczb', // Mathilde Saliou
      'did:plc:jztspcobtrgx7r5mxs3q4noc', // @manhack
    ],
    sources: [{type: 'rss', url: 'https://next.ink/feed/free'}],
  },
]

/** The org focused by default on the `/newsroom` landing page (no did/handle). */
export function getDefaultNewsroomPublisher(): NewsroomPublisher {
  return NEWSROOM_PUBLISHERS[0]
}

export function getNewsroomPublisherByDid(
  did: string,
): NewsroomPublisher | undefined {
  return NEWSROOM_PUBLISHERS.find(p => p.did === did)
}

/**
 * The DIDs whose author feeds make up a publisher's merged page feed: the
 * publisher account plus its reporters, deduplicated.
 */
export function getPublisherFeedDids(publisher: NewsroomPublisher): string[] {
  return Array.from(new Set([publisher.did, ...publisher.reporterDids]))
}

/** The publisher's configured RSS/Atom feed URLs. */
export function getPublisherRssUrls(publisher: NewsroomPublisher): string[] {
  return publisher.sources
    .filter(source => source.type === 'rss')
    .map(source => source.url)
}

/** Display name from the live profile, falling back to the handle. */
export function getPublisherName(profile?: {
  displayName?: string
  handle?: string
}): string {
  return profile?.displayName || profile?.handle || ''
}
