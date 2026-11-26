import {expect, it} from 'vitest';
import {MAX_BOARD_FILE_BYTES, getBoard, readBoardFile} from './chat-boards';

it('extracts UTF-8 notes and preserves the original file bytes', async () => {
  const text = 'Сумма,валюта\n900,₽';
  const file = new File([text], 'notes.csv');
  const document = await readBoardFile(file);
  expect(document).toMatchObject({name:'notes.csv', type:'text/csv', size:file.size, extraction:'ready', text});
  expect(document.blob.size).toBe(file.size);
  expect(document.blob.type).toBe('text/csv');
});

it('opens the bounded document XML in a deflated DOCX and preserves paragraph boundaries', async () => {
  const zipped = 'UEsDBBQAAAAIANtqel1X6hXDhgAAAMkAAAARAAAAd29yZC9kb2N1bWVudC54bWxtjrEOwjAMRH+l6sCIKwaGUDIy8g8hCW2kOo5so5S/p0FCSIjlWb7z6TxWE8g/MGbtVlyymHruZ9ViAMTPEZ3sqcS8eXdidLqtPEElDoXJR5GUJ1zgMAxHQJdyb8dqbhSebZYGblB7SSza7RyWUyfRUw4jNL2R3yy/kWtc9c8RfArg+7x9AVBLAQIUABQAAAAIANtqel1X6hXDhgAAAMkAAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAC1AAAAAAA=';
  const file = new File([Uint8Array.from(atob(zipped), char => char.charCodeAt(0))], 'notes.docx');
  await expect(readBoardFile(file)).resolves.toMatchObject({extraction:'ready', text:'First & second\nNext'});
});

it('retains unreadable documents and raster images without inventing extracted text', async () => {
  const invalidPdf = new File(['invalid'], 'scan.pdf', {type:'text/html'});
  const pdf = await readBoardFile(invalidPdf);
  expect(pdf).toMatchObject({type:'application/pdf', size:invalidPdf.size, extraction:'unsupported'});
  expect(pdf.text).toBeUndefined();
  const image = await readBoardFile(new File(['image bytes'], 'receipt.png'));
  expect(image).toMatchObject({type:'image/png', extraction:'unsupported'});
});

it('rejects empty, unsupported and oversized files before parsing', async () => {
  await expect(readBoardFile(new File([], 'empty.txt'))).rejects.toMatchObject({code:'file-empty'});
  await expect(readBoardFile(new File(['<svg/>'], 'unsafe.svg'))).rejects.toMatchObject({code:'file-type'});
  const oversized = new File([new Uint8Array(MAX_BOARD_FILE_BYTES+1)], 'big.txt');
  await expect(readBoardFile(oversized)).rejects.toMatchObject({code:'file-too-large'});
});

it('rejects invalid board identities before opening IndexedDB', async () => {
  await expect(getBoard('', 'assistant')).rejects.toMatchObject({code:'invalid-board'});
});
