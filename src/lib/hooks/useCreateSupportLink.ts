import {BRAND} from '#/config/brand'

export const SUPPORT_REQUEST_URL = BRAND.links.supportRequest

export enum SupportCode {
  AA_DID = 'AA_DID',
  AA_BIRTHDATE = 'AA_BIRTHDATE',
}

export function useCreateSupportLink() {
  return (_args: {code: SupportCode; email?: string}) => SUPPORT_REQUEST_URL
}
