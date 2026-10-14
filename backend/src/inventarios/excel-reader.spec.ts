import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { posix } from 'node:path';
import { readInventoryWorkbook } from './excel-reader';

async function fixture(prefixed: boolean, absolute: boolean) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Recursos_Seguridad');
  sheet.addTable({
    name: 'Recursos',
    ref: 'A1',
    headerRow: true,
    columns: [{ name: 'nombre' }, { name: 'fecha_ultima_revision' }],
    rows: [
      ['Recurso', new Date('2026-10-01')],
      ['Sin revisión', null],
    ],
  });
  sheet.getColumn(2).numFmt = 'yyyy-mm-dd';
  const zip = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.(xml|rels)$/.test(entry.name)) continue;
    let xml = await entry.async('string');
    if (
      prefixed &&
      /xmlns="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/.test(
        xml,
      )
    ) {
      xml = xml
        .replace(
          /xmlns="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/,
          'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        )
        .replace(/(<\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, '$1x:$2');
    }
    if (absolute && entry.name.endsWith('.rels')) {
      const owner =
        entry.name === '_rels/.rels'
          ? '.'
          : posix.dirname(posix.dirname(entry.name));
      xml = xml.replace(
        /Target="([^"]+)"/g,
        (_match, target: string) =>
          'Target="/' + posix.normalize(posix.join(owner, target)) + '"',
      );
    }
    zip.file(entry.name, xml);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('Excel import compatibility', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'reads prefixes=%s and absolute relationships=%s without altering data',
    async (prefixed, absolute) => {
      const input = await fixture(prefixed, absolute);
      const original = Buffer.from(input);
      const workbook = await readInventoryWorkbook(input);
      const sheet = workbook.getWorksheet('Recursos_Seguridad')!;
      expect(sheet.rowCount).toBe(3);
      expect(sheet.getRow(1).getCell(1).value).toBe('nombre');
      expect(sheet.getRow(2).getCell(1).value).toBe('Recurso');
      expect(sheet.getRow(2).getCell(2).value).toEqual(new Date('2026-10-01'));
      expect(sheet.getRow(3).getCell(2).value).toBeNull();
      expect(input).toEqual(original);
    },
  );
  it('rejects invalid workbook data', async () => {
    await expect(
      readInventoryWorkbook(Buffer.from('not an Excel')),
    ).rejects.toThrow();
  });
});
