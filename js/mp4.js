/* Glitch Reel Machine — flat MP4 muxer (H.264 + AAC/PCM) and codec picker, no library */
'use strict';
function mp4Mux(video, audio){
  // video: {w,h,fps,avcC:Uint8Array,samples:[{data,key}]}  audio: null | {kind:'aac',sr,ch,asc,samples:[{data}]} | {kind:'pcm',sr,ch,pcm:Int16Array}
  const te = new TextEncoder(); const parts = []; let size = 0;
  const box = (type, ...payload) => { const body = concat(payload); const b = new Uint8Array(8 + body.length); const dv = new DataView(b.buffer); dv.setUint32(0, b.length); b.set(te.encode(type), 4); b.set(body, 8); return b; };
  const full = (type, ver, flags, ...payload) => box(type, u8([ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...payload);
  const u8 = a => new Uint8Array(a), u16 = n => u8([(n >> 8) & 255, n & 255]), u32 = n => u8([(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]), str = t => te.encode(t);
  function concat(arrs){ let n = 0; for (const a of arrs) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of arrs){ o.set(a, k); k += a.length; } return o; }
  const u32s = arr => { const o = new Uint8Array(arr.length * 4); const dv = new DataView(o.buffer); arr.forEach((v, i) => dv.setUint32(i * 4, v)); return o; };
  const mvTs = 1000, vTs = video.fps * 1000, vDur = video.samples.length * 1000, durMs = Math.round(video.samples.length / video.fps * 1000);
  // --- mdat layout: video samples then audio ---
  const mdatPayload = [], vOff = [], aOff = []; let pos = 0;
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  for (const sm of video.samples){ vOff.push(pos); mdatPayload.push(sm.data); pos += sm.data.length; }
  let aChunks = 0;
  if (audio && audio.kind === 'aac'){ for (const sm of audio.samples){ aOff.push(pos); mdatPayload.push(sm.data); pos += sm.data.length; } }
  else if (audio && audio.kind === 'pcm'){ const bytes = new Uint8Array(audio.pcm.buffer, audio.pcm.byteOffset, audio.pcm.byteLength); const chunk = 4096 * audio.ch * 2; for (let i = 0; i < bytes.length; i += chunk){ aOff.push(pos); const part = bytes.subarray(i, Math.min(bytes.length, i + chunk)); mdatPayload.push(part); pos += part.length; aChunks++; } }
  const mdatHeaderLen = 8, dataStart = ftyp.length + mdatHeaderLen; // moov goes after mdat, so offsets are known now
  const tkhd = (id, dur, w, h, vol) => full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(dur), u32(0), u32(0), u16(0), u16(0), u16(vol), u16(0), u32s([0x10000,0,0,0,0x10000,0,0,0,0x40000000]), u32(w << 16), u32(h << 16));
  const mdhd = (ts, dur) => full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0));
  const hdlr = (type, name) => full('hdlr', 0, 0, u32(0), str(type), u32(0), u32(0), u32(0), str(name), u8([0]));
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  const stscOne = full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
  // video stbl
  const avc1 = box('avc1', u8([0,0,0,0,0,0]), u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(video.w), u16(video.h), u32(0x480000), u32(0x480000), u32(0), u16(1), new Uint8Array(32), u16(0x18), u16(0xffff), box('avcC', video.avcC));
  const vstbl = box('stbl', full('stsd', 0, 0, u32(1), avc1), full('stts', 0, 0, u32(1), u32(video.samples.length), u32(1000)),
    full('stss', 0, 0, u32(video.samples.filter(x => x.key).length), u32s(video.samples.map((x, i) => x.key ? i + 1 : 0).filter(Boolean))),
    stscOne, full('stsz', 0, 0, u32(0), u32(video.samples.length), u32s(video.samples.map(x => x.data.length))), full('stco', 0, 0, u32(vOff.length), u32s(vOff.map(o => o + dataStart))));
  const vtrak = box('trak', tkhd(1, durMs, video.w, video.h, 0), box('mdia', mdhd(vTs, vDur), hdlr('vide', 'VideoHandler'), box('minf', full('vmhd', 0, 1, u32(0), u32(0)), dinf, vstbl)));
  let atrak = new Uint8Array(0);
  if (audio && audio.kind === 'aac'){
    const asc = audio.asc; const desc = (tag, body) => concat([u8([tag, body.length]), body]);
    const dsi = desc(5, asc), dcd = desc(4, concat([u8([0x40, 0x15]), u8([0,0,0]), u32(0), u32(0), dsi])), es = desc(3, concat([u16(1), u8([0]), dcd, desc(6, u8([2]))]));
    const mp4a = box('mp4a', u8([0,0,0,0,0,0]), u16(1), u32(0), u32(0), u16(audio.ch), u16(16), u32(0), u32(audio.sr << 16), full('esds', 0, 0, es));
    const astbl = box('stbl', full('stsd', 0, 0, u32(1), mp4a), full('stts', 0, 0, u32(1), u32(audio.samples.length), u32(1024)), stscOne,
      full('stsz', 0, 0, u32(0), u32(audio.samples.length), u32s(audio.samples.map(x => x.data.length))), full('stco', 0, 0, u32(aOff.length), u32s(aOff.map(o => o + dataStart))));
    atrak = box('trak', tkhd(2, durMs, 0, 0, 0x100), box('mdia', mdhd(audio.sr, audio.samples.length * 1024), hdlr('soun', 'SoundHandler'), box('minf', full('smhd', 0, 0, u32(0)), dinf, astbl)));
  } else if (audio && audio.kind === 'pcm'){
    const n = audio.pcm.length / audio.ch, perChunk = 4096;
    const sowt = box('sowt', u8([0,0,0,0,0,0]), u16(1), u16(1), u16(0), u32(0), u16(audio.ch), u16(16), u16(0), u16(0), u32(audio.sr << 16), u32(1), u32(2), u32(audio.ch * 2), u32(2));
    const stscEntries = []; const fullChunks = Math.floor(n / perChunk), rem = n - fullChunks * perChunk;
    if (fullChunks) stscEntries.push([1, perChunk]); if (rem) stscEntries.push([fullChunks + 1, rem]);
    const astbl = box('stbl', full('stsd', 0, 0, u32(1), sowt), full('stts', 0, 0, u32(1), u32(n), u32(1)),
      full('stsc', 0, 0, u32(stscEntries.length), u32s(stscEntries.flatMap(([f, c]) => [f, c, 1]))), full('stsz', 0, 0, u32(audio.ch * 2), u32(n)), full('stco', 0, 0, u32(aOff.length), u32s(aOff.map(o => o + dataStart))));
    atrak = box('trak', tkhd(2, durMs, 0, 0, 0x100), box('mdia', mdhd(audio.sr, n), hdlr('soun', 'SoundHandler'), box('minf', full('smhd', 0, 0, u32(0)), dinf, astbl)));
  }
  const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(mvTs), u32(durMs), u32(0x10000), u16(0x100), u16(0), u32(0), u32(0), u32s([0x10000,0,0,0,0x10000,0,0,0,0x40000000]), new Uint8Array(24), u32(3));
  const moov = box('moov', mvhd, vtrak, atrak);
  const mdatHead = new Uint8Array(8); new DataView(mdatHead.buffer).setUint32(0, 8 + pos); mdatHead.set(str('mdat'), 4);
  return new Blob([ftyp, mdatHead, ...mdatPayload, moov], {type: 'video/mp4'});
}
async function pickVideoCodec(w, h, fps, bitrate){
  for (const codec of ['avc1.640033', 'avc1.640032', 'avc1.64002a', 'avc1.640028', 'avc1.4d0032', 'avc1.42e032']){
    try { const cfg = {codec, width: w, height: h, bitrate, framerate: fps, avc: {format: 'avc'}, latencyMode: 'quality'}; const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch(e){}
  } return null;
}
