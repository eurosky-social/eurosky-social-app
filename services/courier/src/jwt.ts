import {createPrivateKey, type KeyObject, sign} from 'node:crypto'

/**
 * Signs a compact JWT. ES256 signatures use the raw r||s form JWTs require,
 * not Node's default DER encoding.
 */
export function signJwt(
  header: {alg: 'ES256' | 'RS256'} & Record<string, unknown>,
  claims: Record<string, unknown>,
  key: KeyObject,
): string {
  const input = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`
  const signature =
    header.alg === 'ES256'
      ? sign('sha256', Buffer.from(input), {key, dsaEncoding: 'ieee-p1363'})
      : sign('sha256', Buffer.from(input), key)
  return `${input}.${signature.toString('base64url')}`
}

export function loadPrivateKey(pem: string): KeyObject {
  return createPrivateKey({key: pem, format: 'pem'})
}

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url')
}
