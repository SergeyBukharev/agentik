import type {Language} from './language';

export const currentAgreementDate = '2026-11-26';
export const currentAgreementVersion = currentAgreementDate + '.2';
export const signatureWidth = 1000;
export const signatureHeight = 320;
export const signaturePointLimit = 2048;
export const signatureStrokeLimit = 64;

export type InkPoint = {x:number; y:number};
export type InkStroke = InkPoint[];
export type Signature = {kind:'ink'; strokes:InkStroke[]} | {kind:'name'; name:string};
export type AgreementRecord = {version:string; acceptedAt:number; language:Language; signature:Signature};

export function agreementStorageKey(accountId?:string) {
  return 'agentik:agreement:' + (accountId ? 'account:' + encodeURIComponent(accountId) : 'guest');
}

function isInkPoint(value: unknown): value is InkPoint {
  if (!value || typeof value !== 'object') return false;
  const {x,y} = value as InkPoint;
  return Number.isFinite(x) && x >= 0 && x <= signatureWidth && Number.isFinite(y) && y >= 0 && y <= signatureHeight;
}

export function hasSignatureInk(strokes: unknown): strokes is InkStroke[] {
  if (!Array.isArray(strokes) || strokes.length > signatureStrokeLimit) return false;
  let distance = 0;
  let points = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || !stroke.length || stroke.length + points > signaturePointLimit || !stroke.every(isInkPoint)) return false;
    points += stroke.length;
    for (let i = 1; i < stroke.length; i++) {
      distance += Math.hypot(stroke[i].x - stroke[i-1].x, stroke[i].y - stroke[i-1].y);
    }
  }
  return distance >= 12;
}

function validatedSignature(value: unknown): Signature | null {
  if (!value || typeof value !== 'object') return null;
  const signature = value as Signature;
  if (signature.kind === 'ink' && hasSignatureInk(signature.strokes)) return signature;
  if (signature.kind === 'name' && typeof signature.name === 'string') {
    const name = signature.name.trim();
    if (name.length >= 2 && name.length <= 100 && /\p{L}/u.test(name)) return {kind:'name',name};
  }
  return null;
}

export function readAgreement(storage: Pick<Storage,'getItem'>, accountId?:string): AgreementRecord | null {
  try {
    const raw = storage.getItem(agreementStorageKey(accountId));
    if (!raw || raw.length > 150_000) return null;
    const record: Partial<AgreementRecord> | null = JSON.parse(raw);
    if (!record || record.version !== currentAgreementVersion || typeof record.acceptedAt !== 'number'
      || !Number.isSafeInteger(record.acceptedAt) || record.acceptedAt <= 0 || record.acceptedAt > 8.64e15
      || (record.language !== 'ru' && record.language !== 'en')) return null;
    const signature = validatedSignature(record.signature);
    return signature ? {version:record.version,acceptedAt:record.acceptedAt,language:record.language,signature} : null;
  } catch {
    return null;
  }
}

export function saveAgreement(storage: Pick<Storage,'setItem'>, accountId: string | undefined, value: Signature, language:Language, acceptedAt = Date.now()): AgreementRecord {
  const signature = validatedSignature(value);
  if (!signature) throw new Error('Signature required');
  const record = {version:currentAgreementVersion,acceptedAt,language,signature};
  storage.setItem(agreementStorageKey(accountId),JSON.stringify(record));
  return record;
}
