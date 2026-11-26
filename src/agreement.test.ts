import {expect,it} from 'vitest';
import {agreementStorageKey, currentAgreementVersion, hasSignatureInk, readAgreement, saveAgreement} from './agreement';

const ink = [[{x:50,y:45},{x:88,y:91}]];

it('requires a stroke rather than a tap and bounds the point coordinates',()=>{
  expect(hasSignatureInk([[{x:4,y:4}]])).toBe(false);
  expect(hasSignatureInk([[{x:4,y:4},{x:5,y:5}]])).toBe(false);
  expect(hasSignatureInk([[{x:-90,y:4},{x:20,y:24}]])).toBe(false);
  expect(hasSignatureInk(ink)).toBe(true);
});

it('restores the current revision locally without mixing guest and account records',()=>{
  const data = new Map<string,string>();
  const storage={setItem:(key:string,value:string)=>void data.set(key,value),getItem:(key:string)=>data.get(key)??null};
  saveAgreement(storage,'account-A',{kind:'ink',strokes:ink},'ru',1000);
  saveAgreement(storage,undefined,{kind:'name',name:'  Example User  '},'en',2000);
  expect(readAgreement(storage,'account-A')).toEqual({version:currentAgreementVersion,signature:{kind:'ink',strokes:ink},language:'ru',acceptedAt:1000});
  expect(readAgreement(storage,undefined)?.signature).toEqual({kind:'name',name:'Example User'});
  expect(readAgreement(storage,'account-B')).toBeNull();
  data.set(agreementStorageKey('account-A'),JSON.stringify({...readAgreement(storage,'account-A'),version:'older'}));
  expect(readAgreement(storage,'account-A')).toBeNull();
});

it('rejects corrupted and blank signatures',()=>{
  const records = new Map<string,string>();
  const storage={setItem:(key:string,value:string)=>void records.set(key,value),getItem:(key:string)=>records.get(key)??null};
  expect(()=>saveAgreement(storage,'id',{kind:'name',name:'  '},'ru')).toThrow();
  expect(records.size).toBe(0);
  records.set(agreementStorageKey('id'),'not json');
  expect(readAgreement(storage,'id')).toBeNull();
});
