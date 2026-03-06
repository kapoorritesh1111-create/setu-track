// src/lib/exports/simpleZip.ts
// Minimal zip builder (deflate) with no external dependencies.

import { deflateRawSync } from "zlib";

type ZipFile = { name: string; data: Buffer };

// CRC32 implementation (standard polynomial 0xEDB88320)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

export function buildZip(files: ZipFile[]) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);

    // Local file header
    const localHeader = Buffer.concat([
      u32(0x04034b50), // signature
      u16(20), // version needed
      u16(0), // flags
      u16(8), // compression method (deflate)
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0), // extra len
      nameBuf,
    ]);

    parts.push(localHeader, compressed);

    // Central directory header
    const centralHeader = Buffer.concat([
      u32(0x02014b50), // signature
      u16(20), // version made by
      u16(20), // version needed
      u16(0), // flags
      u16(8), // compression
      u16(0), // time
      u16(0), // date
      u32(crc),
      u32(compressed.length),
      u32(raw.length),
      u16(nameBuf.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk start
      u16(0), // int attrs
      u32(0), // ext attrs
      u32(offset), // local header offset
      nameBuf,
    ]);

    central.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralStart = offset;
  const centralBuf = Buffer.concat(central);
  offset += centralBuf.length;

  const end = Buffer.concat([
    u32(0x06054b50), // end signature
    u16(0), // disk
    u16(0), // start disk
    u16(files.length),
    u16(files.length),
    u32(centralBuf.length),
    u32(centralStart),
    u16(0), // comment len
  ]);

  return Buffer.concat([...parts, centralBuf, end]);
}
