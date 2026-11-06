import {type CID} from 'multiformats/cid'

/** A Merkle Search Tree node, as stored in an atproto repo. */
type MstNode = {
  /** Subtree with keys sorted before the first entry. */
  l: CID | null
  e: {
    /** Bytes shared with the previous entry's key in this node. */
    p: number
    /** The rest of the key. */
    k: Uint8Array
    v: CID
    /** Subtree with keys between this entry and the next. */
    t: CID | null
  }[]
}

type Commit = {data: CID}

function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0
  let shift = 0
  let length = 0
  let byte: number
  do {
    byte = bytes[offset + length++]
    value += (byte & 0x7f) * 2 ** shift
    shift += 7
  } while (byte & 0x80)
  return [value, length]
}

/** Byte length of the CIDv1 at the start of `bytes`. */
function cidLength(bytes: Uint8Array): number {
  let offset = 0
  for (let i = 0; i < 3; i++) {
    // version, codec, multihash code
    offset += readVarint(bytes, offset)[1]
  }
  const [digestLength, length] = readVarint(bytes, offset)
  return offset + length + digestLength
}

function toKey(bytes: Uint8Array): string {
  let key = ''
  for (const byte of bytes) key += byte.toString(16).padStart(2, '0')
  return key
}

/**
 * Reads a CARv1 file into its blocks, keyed by CID bytes. Blocks stay as raw
 * bytes; only the commit and MST nodes are decoded later, never the records.
 */
function readCar(bytes: Uint8Array) {
  let offset = 0
  const next = () => {
    const [value, length] = readVarint(bytes, offset)
    offset += length
    return value
  }

  const headerLength = next()
  const header = bytes.subarray(offset, offset + headerLength)
  offset += headerLength

  const blocks = new Map<string, Uint8Array>()
  while (offset < bytes.length) {
    const sectionLength = next()
    const section = bytes.subarray(offset, offset + sectionLength)
    offset += sectionLength
    const length = cidLength(section)
    blocks.set(toKey(section.subarray(0, length)), section.subarray(length))
  }
  return {header, blocks}
}

/**
 * Counts records per collection from a repo CAR (`com.atproto.sync.getRepo`).
 * Every MST key is `<collection>/<rkey>`, so walking the tree from the commit
 * gives exact counts in one download, without decoding any records.
 */
export async function countRepoRecords(
  car: Uint8Array,
): Promise<Map<string, number>> {
  // ~190KB, and only this dialog needs it.
  const cbor = await import('@ipld/dag-cbor')
  const {header, blocks} = readCar(car)
  const {roots} = cbor.decode<{roots: CID[]}>(header)

  const getBlock = <T>(cid: CID | null | undefined): T | undefined => {
    if (!cid) return undefined
    const block = blocks.get(toKey(cid.bytes))
    return block ? cbor.decode<T>(block) : undefined
  }

  const commit = getBlock<Commit>(roots[0])
  if (!commit) {
    throw new Error('Repo CAR is missing its commit block')
  }

  const counts = new Map<string, number>()
  const decoder = new TextDecoder()
  const pending: (CID | null)[] = [commit.data]
  while (pending.length > 0) {
    const node = getBlock<MstNode>(pending.pop())
    if (!node) continue

    pending.push(node.l)
    let previousKey = new Uint8Array(0)
    for (const entry of node.e) {
      const key = new Uint8Array(entry.p + entry.k.length)
      key.set(previousKey.subarray(0, entry.p))
      key.set(entry.k, entry.p)
      previousKey = key

      const path = decoder.decode(key)
      const collection = path.slice(0, path.indexOf('/'))
      counts.set(collection, (counts.get(collection) ?? 0) + 1)
      pending.push(entry.t)
    }
  }
  return counts
}
