import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { posix } from 'node:path';

/** Normalize equivalent OOXML encodings in memory; never change cell values. */
export async function readInventoryWorkbook(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let changed = false;
  let xmlBytes = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/\.(xml|rels)$/.test(entry.name)) continue;
    let xml = await entry.async('string');
    xmlBytes += Buffer.byteLength(xml);
    if (xmlBytes > 20 * 1024 * 1024) throw new Error('Excel demasiado grande');
    const original = xml;
    // ExcelJS expects unprefixed SpreadsheetML tags, although prefixes are valid OOXML.
    const namespaces = [
      ...xml.matchAll(
        /xmlns:([A-Za-z_][\w.-]*)=["']http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main["']/g,
      ),
    ];
    for (const namespace of namespaces) {
      const prefix = namespace[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      xml = xml.replace(new RegExp('(<\\/?)' + prefix + ':', 'g'), '$1');
      xml = xml.replace(
        namespace[0],
        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      );
    }
    // Resolve package-absolute relationship targets relative to their owning part.
    if (entry.name.endsWith('.rels')) {
      const ownerDirectory =
        entry.name === '_rels/.rels'
          ? '.'
          : posix.dirname(posix.dirname(entry.name));
      xml = xml.replace(
        /\bTarget=(["'])\/([^"']+)\1/g,
        (_match, quote: string, target: string) =>
          'Target=' + quote + posix.relative(ownerDirectory, target) + quote,
      );
    }
    if (xml !== original) {
      zip.file(entry.name, xml);
      changed = true;
    }
  }
  const workbook = new ExcelJS.Workbook();
  const input = changed
    ? await zip.generateAsync({ type: 'nodebuffer' })
    : buffer;
  await workbook.xlsx.load(
    input as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  return workbook;
}
