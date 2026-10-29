/* Maut ki machine — GLSL effect chain */
'use strict';
const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tBase, tOver, tText, tPrev, tPat;
uniform vec2 uRes;
uniform float uTime, uPulse, uHue, uCycle, uReps, uSplit, uTear, uPix, uScan, uGrain, uFeed, uRings, uGlow, uWarp, uThresh,
  uPattern, uPatInv, uTextSplit, uMirror, uSeed, uDim, uOverOn, uTextOn, uSat, uCon, uPoster, uLookMix, uSlice, uSort, uRoll, uMelt, uZoom, uShake, uKaleido, uSpin,
  uEdges, uHalf, uDither, uLookSwap, uBlur, uDisp, uLeak, uBlendAmt, uTone, uTextAlpha, uPolar, uGhost, uBands,
  uSmear, uSmearA, uShock, uShockT, uShockN, uTaffy, uSlit, uWeave, uCorrupt, uOil, uContour, uLed, uVeil, uVar, uVar2,
  uSplitOn, uSplitX, uSplitDir, uSplitSide, uSplitPost, uQuadOn, uInsetOn, uInsetT, uErodeOn, uErodeB;
uniform vec4 uQuadT, uInsetR; uniform vec2 uErodeM; uniform vec3 uPalS[4];
// ice strip (letterboxed band, glowing inset, pixel-stretch stripes, solid panels) — from the blue reference reel
uniform float uStripOn, uStripMode, uStripH, uStripX, uStripQuad, uStripRow, uStripInv, uStripTint, uStripGlow, uStripLit, uStripLine;
uniform float uPinOn, uPinN, uPinR, uPinRot, uPinFold, uPinChunk, uPanelOn;
uniform float uBandOn, uBandN, uBandPh, uBandLit, uLoupeOn, uLoupeMag, uLoupeR, uPixHold, uPixRow; uniform vec2 uLoupeC;
uniform float uRefOn, uRefMode, uRefAlt, uRefX, uRefX2, uRefT, uRefHit; uniform vec4 uRefR, uRefB0, uRefB1, uRefB2; uniform vec3 uRefC[5]; uniform vec2 uPinM; uniform vec4 uPanelR; uniform vec3 uPanelC;
uniform vec4 uStripR, uStripO, uStripZ; uniform vec3 uStripC[4]; uniform vec3 uStripP1, uStripP2;
uniform int uLookA, uLookB, uLook2, uTextMode, uBlendMode;
uniform vec3 uPalA[4]; uniform vec3 uPalB[4]; uniform vec3 uPal2[4];
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<3;i++){ v += a*vnoise(p); p = p*2.03+vec2(1.7,9.2); a *= .5; } return v; }
float luma(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
vec3 sat(vec3 c, float s){ return mix(vec3(luma(c)), c, s); }
vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a); return c*ca + cross(k,c)*sin(a) + k*dot(k,c)*(1.-ca); }
vec3 gmap(float k, vec3 p[4]){ k = clamp(k,0.,1.)*3.; if(k<1.) return mix(p[0],p[1],k); if(k<2.) return mix(p[1],p[2],k-1.); return mix(p[2],p[3],k-2.); }
vec3 look(vec3 c, int id, vec3 p[4], float th){
  float l = luma(c);
  if(id==0){ c = (c-.5)*1.3+.5; c = sat(c,1.45); }
  else if(id==1){ c = hueShift(c,uHue); c = sat(c,1.9); c = (c-.5)*1.25+.5; }
  else if(id==2){ float k = clamp((l-.5)*1.6+.5,0.,1.); k = abs(fract(k*uReps*.5+uCycle)*2.-1.); c = mix(gmap(k,p), c, .3); }
  else if(id==3){ c = 1.-abs(1.-2.*c); c = hueShift(c,uHue); c = sat(c,1.7); c *= 1.1-.35*l; }
  else if(id==4){ c = 1.-c; c = hueShift(c,uHue*.5); c = sat(c,1.5); }
  else if(id==5){ float m = smoothstep(th-.05,th+.05,l); c = mix(p[0],p[3],m); }
  else if(id==6){ float k = smoothstep(.12,.82,l); vec3 d = mix(mix(p[0],p[1],.45), p[2], k); d = mix(d,p[3],smoothstep(.86,1.,l)); c = mix(d, c, .2); }
  else if(id==7){ c = floor(clamp(sat(c,1.8),0.,1.)*3.999)/3.; c = c.brg; }
  else if(id==8){ vec3 s = vec3(l)*vec3(1.08,.94,.74); c = mix(c,s,.45); c = c*.84+.08; c.g += (1.-l)*.03; }
  else if(id==9){ c = sat(c.gbr,2.2); c = (c-.5)*1.4+.5; c *= 1.15-.55*l; }
  else if(id==10){ c = gmap(smoothstep(.04,.96,l), p); }   // pure gradient map: shadows → mids → highlights, the picture stays readable
  return clamp(c,0.,1.);
}
float bayer(vec2 p){ ivec2 i = ivec2(mod(p,4.)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[i.y*4+i.x])/16.; }
// treatments for the analysis grid and the inset: the same shot read different ways
const vec3 TH[4] = vec3[4](vec3(.04,.08,.4), vec3(.07,.7,.69), vec3(.96,.89,.35), vec3(.91,.14,.11));
vec3 treat(int id, vec2 tuv, vec3 b){ float l = luma(b);
  if(id==0) return vec3(step(.5 + (bayer(gl_FragCoord.xy)-.5)*.25, l));                                             // threshold
  if(id==1){ vec2 e = 1.5/uRes; float gx = luma(texture(tBase,tuv+vec2(e.x,0.)).rgb)-luma(texture(tBase,tuv-vec2(e.x,0.)).rgb), gy = luma(texture(tBase,tuv+vec2(0.,e.y)).rgb)-luma(texture(tBase,tuv-vec2(0.,e.y)).rgb);
    return vec3(smoothstep(.04,.22,length(vec2(gx,gy)))); }                                                         // edge lines
  if(id==2) return gmap(clamp(l*1.15 + (hash(gl_FragCoord.xy*.37 + uTime)-.5)*.14, 0., 1.), TH);                  // thermal camera
  if(id==3) return vec3(clamp((l-.5)*1.7+.5, 0., 1.));                                                               // hard grey
  if(id==4) return vec3(1.) - vec3(smoothstep(.35, .62, l));                                                         // inverted silhouette
  return gmap(l, uPalS); }                                                                                           // the style's palette
vec3 sampleBase(vec2 uv, float s, vec2 dir){ return vec3(texture(tBase,uv+dir*s).r, texture(tBase,uv).g, texture(tBase,uv-dir*s).b); }
vec3 blendMode(vec3 a, vec3 b, int m){
  if(m==1) return 1.-(1.-a)*(1.-b);           // screen
  if(m==2) return abs(a-b);                   // difference
  if(m==3) return a*b*1.6;                    // multiply (lifted)
  if(m==4) return max(a,b);                   // lighten
  if(m==5) return mix(2.*a*b, 1.-2.*(1.-a)*(1.-b), step(.5,a)); // overlay
  return b;
}
// ---- ice strip helpers ----
float rectSD(vec2 p, vec4 r){ vec2 c = (r.xy+r.zw)*.5, h = (r.zw-r.xy)*.5; vec2 d = abs(p-c)-h; return length(max(d,0.)) + min(max(d.x,d.y),0.); }
bool inR(vec2 p, vec4 r){ return p.x>=r.x && p.x<=r.z && p.y>=r.y && p.y<=r.w; }
vec3 iceMap(float l){ l = clamp(l,0.,1.); if(uStripInv>.5) l = 1.-l; return gmap(l, uStripC); }
// footage seen through a sub-rectangle of the band, cover-fitted (keeps the picture's proportions)
vec3 stripFoot(vec2 bp, vec4 r){ vec2 f = (bp - r.xy)/max(r.zw-r.xy, vec2(1e-4)); float fa = uRes.x/uRes.y, ia = ((r.z-r.x)*uRes.x)/max(1e-4,(r.w-r.y)*uStripH*uRes.y);
  vec2 sc = ia > fa ? vec2(1., fa/ia) : vec2(ia/fa, 1.); vec3 b = texture(tBase, .5 + (f-.5)*sc).rgb; float l = luma(b); l = clamp((l-.08)*1.25, 0., 1.);
  vec3 c = iceMap(l); if(uStripTint>.5 && uStripTint<1.5) c = mix(c, c*uStripC[2]*1.4, .7); else if(uStripTint>1.5) c = mix(c, c*uStripC[1]*1.9, .65); return c; }
// a single row of the frame stretched into vertical bars (or one column into horizontal lines)
vec3 stripeV(vec2 bp){ float x = floor(bp.x*uRes.x*.5)/(uRes.x*.5); float l = luma(texture(tBase, vec2(x, uStripRow)).rgb); l = smoothstep(.12,.85,l); return iceMap(l)*(.55+.6*l); }
vec3 stripeH(vec2 bp){ float y = floor(bp.y*uRes.y*uStripH*.5)/(uRes.y*uStripH*.5); float l = luma(texture(tBase, vec2(uStripRow, y)).rgb); return vec3(smoothstep(.2,.9,l)); }
// ---- reference-reel treatments, round 3 (Video-2271): full-frame graphic systems over a readable shot ----
vec3 grad5(float t, vec3 c[5]){ t = clamp(t,0.,1.)*4.; int i = int(min(3., floor(t))); float f = t - float(i); return i==0 ? mix(c[0],c[1],f) : i==1 ? mix(c[1],c[2],f) : i==2 ? mix(c[2],c[3],f) : mix(c[3],c[4],f); }
float lineBox(vec2 p, vec4 r, float w){ vec2 px = 1./uRes; bool inX = p.x>=r.x-px.x*w && p.x<=r.z+px.x*w, inY = p.y>=r.y-px.y*w && p.y<=r.w+px.y*w;
  float e = (inY && (abs(p.x-r.x)<px.x*w || abs(p.x-r.z)<px.x*w)) || (inX && (abs(p.y-r.y)<px.y*w || abs(p.y-r.w)<px.y*w)) ? 1. : 0.;
  // the construction diagonals (both) inside the box
  if(p.x>r.x && p.x<r.z && p.y>r.y && p.y<r.w){ vec2 q = (p-r.xy)/(r.zw-r.xy); float d1 = abs(q.x-q.y)*(r.z-r.x)*uRes.x, d2 = abs(q.x-(1.-q.y))*(r.z-r.x)*uRes.x; e = max(e, step(min(d1,d2), w*.8)*.75); }
  return e; }
vec3 refFx(vec3 col, vec3 base, vec2 uv){ float l = luma(base); int m = int(uRefMode+.5); float asp = uRes.x/uRes.y;
  if(m==1){ // NEON THERMAL (2271 0:02–0:07): spectral false colour on luma + bloom; on hits a white threshold slab
    vec3 bl = vec3(0.); for(int i=0;i<12;i++){ float a = float(i)*.5236; vec2 o = vec2(cos(a), sin(a)*asp)*.018; bl += max(texture(tBase, uv+o).rgb - .45, 0.); } bl /= 12.;
    float t = pow(clamp((l-.05)*1.45,0.,1.), .95) + (hash(floor(gl_FragCoord.xy*.5) + floor(uTime*15.))-.5)*.09;
    vec3 c = grad5(t, uRefC); c += grad5(clamp(luma(bl)*3.,0.,1.), uRefC)*luma(bl)*2.4; col = c;
    if(uRefHit>.5 && inR(vUv, uRefR)){ float th = step(.5 + (bayer(gl_FragCoord.xy)-.5)*.35, l*1.25); col = mix(vec3(.02), vec3(.97), th); } }
  else if(m==2){ // YELLOW MAT (2271 0:13): a flat mat with the shot inset on a tilted cut, the inset in a low-key duotone; alt = full-bleed 2-tone dither
    if(uRefAlt>.5){ float d = step(.5 + (bayer(gl_FragCoord.xy)-.5)*.6, l*1.15); col = mix(uRefC[1], uRefC[0], d); col = mix(col, uRefC[2], step(.8, l)*.35); }
    else { vec4 r = uRefR; bool inside = inR(vUv, r);
      // one corner sliced off on a 45° line (the mat bites into the inset)
      vec2 q = (vUv - r.xy)/(r.zw - r.xy); if(inside && (q.x + (1.-q.y)) < uRefX*.5) inside = false; if(inside && ((1.-q.x) + q.y) < uRefX2*.4) inside = false;
      if(inside){ float k = pow(clamp(l*1.1,0.,1.), 1.5); col = k < .5 ? mix(vec3(0.), uRefC[3], k*2.) : mix(uRefC[3], uRefC[4], (k-.5)*2.); }
      else col = uRefC[0] * (.94 + .06*hash(floor(gl_FragCoord.xy*.5))); } }
  else if(m==3){ // WIREFRAME (2271 0:18): a vertical split (right half channel-swapped), a laser beam, construction-line boxes
    vec3 c = clamp((base-.5)*1.35+.5,0.,1.); c = sat(c, 1.6);
    if(vUv.x > uRefX){ c = sat(c.gbr*vec3(1.1,1.2,.8), 1.7); c = mix(c, uRefC[1], .18); }
    float lz = exp(-abs(vUv.x - uRefX2)*uRes.x*.35); c += mix(uRefC[0], vec3(1.), .6)*lz*1.6 + uRefC[0]*exp(-abs(vUv.x - uRefX2)*uRes.x*.04)*.35;
    float w = max(1.2, uRes.y/600.); float e = max(max(lineBox(vUv, uRefB0, w), lineBox(vUv, uRefB1, w)), lineBox(vUv, uRefB2, w)); col = mix(c, vec3(1.), e*.85); }
  else if(m==4){ // BLOCK FIELD (2271 0:17): the frame becomes rectangles of 2-colour noise, each carrying its cell's light; black notches and slits
    vec2 g = vec2(9., 9./asp*1.4); vec2 cid = floor(vUv*g); float hb = hash(cid + floor(uRefT)*3.17);
    vec2 cid2 = hb < .35 ? floor(vUv*g*vec2(.5,1.))*vec2(2.,1.) : cid;   // some blocks merge horizontally
    vec2 cc = (cid2 + (hb < .35 ? vec2(1.,.5) : vec2(.5)))/g; float lb = luma(texture(tBase, cc).rgb); lb = clamp((lb-.08)*1.3,0.,1.);
    float lp = clamp((l-.06)*1.35,0.,1.); float n = hash(floor(gl_FragCoord.xy*.5) + floor(uTime*12.)); float on = step(n, mix(lb, lp, .7)*.95 + .03);
    col = mix(uRefC[1], uRefC[0], on); col *= .82 + .18*hash(cid2+.7);
    if(hash(cid2 + 5.1 + floor(uRefT)) < .1) col = vec3(0.);
    float sl = fract(vUv.y*g.y); if(hash(vec2(cid.y, floor(uRefT)) + 9.3) < .1 && sl > .45 && sl < .62 && hash(cid*1.7) < .5) col = uRefC[2]*.25;
    if(vUv.x < .06 || vUv.x > .94) col = vec3(0.); }
  return clamp(col, 0., 1.); }
vec3 iceStrip(vec3 col){
  float y0 = .5 - uStripH*.5; if(vUv.y < y0 || vUv.y > y0 + uStripH) return vec3(0.);
  vec2 bp = vec2(vUv.x, (vUv.y - y0)/uStripH); int m = int(uStripMode + .5); vec3 c = vec3(0.); float glowSrc = 0.; vec3 gcol = uStripC[3];
  float px = 1./(uStripH*uRes.y);   // one pixel in band units (vertical)
  if(m==0 || m==5){ // glowing inset (5: a solid panel fills the band to the left of the split)
    if(m==5 && bp.x < uStripX){ c = uStripP1 * (.92 + .08*stripeH(bp)); }
    else if(inR(bp, uStripR)) c = stripFoot(bp, uStripR);
    else if(uStripZ.z > uStripZ.x && inR(bp, uStripZ)) c = stripeV(bp);
    float dR = rectSD(bp*vec2(uRes.x/(uStripH*uRes.y),1.), uStripR*vec4(uRes.x/(uStripH*uRes.y),1.,uRes.x/(uStripH*uRes.y),1.)); if(dR > 0.) glowSrc = exp(-dR*28.)*uStripLit;
    if(uStripLine > .5 && abs(rectSD(bp, uStripO)) < px*1.2) c = max(c, uStripC[2]*.8); }
  else if(m==1){ // solid panels: halves or a 2×2 checker
    bool on1, on2; if(uStripQuad > .5){ on1 = bp.x < uStripX && bp.y > .5; on2 = bp.x >= uStripX && bp.y <= .5; } else { on1 = bp.x < uStripX; on2 = bp.x >= uStripX; }
    vec3 hl = stripeH(bp); if(on1) c = uStripP1*(.9+.1*hl); else if(on2) c = uStripP2*(.9+.1*hl);
    float edge = abs(bp.x - uStripX)*uRes.x/(uStripH*uRes.y); if(!on1 && !on2) glowSrc = exp(-edge*22.)*.6; gcol = luma(uStripP1) > luma(uStripP2) ? uStripP1 : uStripP2; }
  else if(m==2){ // stripe frame: bars fill the outer box around a dark inner window
    if(inR(bp, uStripR)) c = stripFoot(bp, uStripR)*.3; else if(inR(bp, uStripO) && bp.x > uStripZ.x) c = stripeV(bp); }
  else if(m==4){ // the whole band, with a stripe column at one side
    c = stripFoot(bp, vec4(0.,0.,1.,1.)); if(uStripZ.z > uStripZ.x && inR(bp, uStripZ)) c = stripeV(bp); }
  else if(m==6){ // horizontal-line stretch on one side of the band
    if(bp.x < uStripX) c = stripeH(bp)*uStripP1*.85; }
  c += gcol*glowSrc*uStripGlow;
  return clamp(c, 0., 1.); }
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y; float tq = floor(uTime*12.);
  // every effect draws its character from these, so each cut re-rolls how it looks
  float V1 = fract(uVar*1.73+.13), V2 = fract(uVar*3.11+.37), V3 = fract(uVar*5.87+.71),
        V4 = fract(uVar*9.31+.29), V5 = fract(uVar*13.7+.53), V6 = fract(uVar*21.3+.17),
        V7 = fract(uVar*7.19+.61), V8 = fract(uVar*17.1+.83), B1 = fract(uVar2*2.71+.41);
  // ---- frame mechanisms: remap before any other geometry ----
  int quadQ = 0; if(uQuadOn>.5){ quadQ = int(step(.5, vUv.x)) + 2*int(step(.5, vUv.y)); uv = fract(vUv*2.); }
  if(uErodeOn>.5) uv = (uv - uErodeM) / (1. - 2.*uErodeM);
  // pinwheel box (landscape reference reel): boxed on black, big displaced chunks at the box edge, a mirrored diagonal fold, a spinning pinwheel of the shot
  float pinW = 0., pinF = 0.;
  if(uPinOn>.5){ vec2 pm = uPinM; uv = (uv - pm)/(1. - 2.*pm);
    vec2 pbs = vec2(6., 6.*uRes.y/uRes.x), pbc = floor(vUv*pbs); float pe = min(min(vUv.x-pm.x, 1.-pm.x-vUv.x)*uRes.x, min(vUv.y-pm.y, 1.-pm.y-vUv.y)*uRes.y)/uRes.x, phb = hash(pbc + uPinChunk*13.1 + uSeed);
    if(abs(pe) < .7/pbs.x && phb < .22) uv += (vec2(hash(pbc+3.7), hash(pbc+8.1))-.5)*.2;
    float pdg = vUv.x*asp - vUv.y + (uPinFold-.5)*1.1; if(abs(pdg - .3) < .085){ uv = vec2(1.-uv.y, 1.-uv.x); pinF = 1.; }
    vec2 pq = (uv-.5)*vec2(asp,1.); float pr = length(pq);
    if(pr < uPinR){ float pan = atan(pq.y,pq.x) + uPinRot, pseg = 6.2831853/uPinN, pk = floor(pan/pseg);
      if(mod(pk,2.) < 1.){ float a2 = pan - pseg*.5 - uPinRot*2.; vec2 q2 = vec2(cos(a2), sin(a2))*pr*1.3; uv = .5 + vec2(q2.x/asp, q2.y); pinW = 1.; } } }
  // loupe (Specimen): inside the circle the shot is magnified; the ring and crosshair are drawn after the look
  if(uLoupeOn>.5){ vec2 lq=(vUv-uLoupeC)*vec2(asp,1.); if(length(lq)<uLoupeR) uv = uLoupeC + (vUv-uLoupeC)/uLoupeMag; }
  // ---- geometry ----
  vec2 c = uv-.5; c /= (1.+uZoom*.18);
  if(uSpin>0.){ float a = uSpin*sin(uTime*1.7)*.6; float ca=cos(a), sa=sin(a); c = vec2(c.x*ca - c.y*sa/asp, c.x*sa*asp + c.y*ca); }
  if(uKaleido>0.){ vec2 q = vec2(c.x*asp, c.y); float r = length(q), an = atan(q.y,q.x); float seg = 6.2831853/max(2.,floor(2.+uKaleido*10.)); an = abs(mod(an+uTime*.2, seg)-seg*.5); vec2 k = vec2(cos(an),sin(an))*r; c = mix(c, vec2(k.x/asp,k.y), smoothstep(0.,.25,uKaleido)); }
  if(uPolar>0.){ vec2 q = vec2(c.x*asp, c.y)+1e-4; float r = length(q), an = atan(q.y,q.x); vec2 pc = vec2(an/6.2831853 + uTime*.04, r*1.6 - uTime*.12); c = mix(c, pc, smoothstep(0.,.3,uPolar)*min(1.,uPolar*1.2)); }
  uv = c+.5;
  uv += (vec2(hash(vec2(tq,uSeed)),hash(vec2(tq+7.,uSeed)))-.5)*uShake*.08;
  if(uMirror>.5) uv.x = uv.x<.5 ? uv.x : 1.-uv.x; else if(uMirror>.0) uv.x = mix(uv.x, uv.x<.5 ? uv.x : 1.-uv.x, step(.5-uMirror*.5, uv.x)*step(uv.x,.5+uMirror*.5));
  // liquid warp: fbm displacement, not sine
  if(uWarp>0.){ vec2 n = vec2(fbm(uv*3.+uTime*.35+uSeed), fbm(uv*3.+vec2(5.2,1.3)-uTime*.3)); uv += (n-.5)*uWarp*.09; }
  // displacement by the image's own luma field (organic lens)
  if(uDisp>0.){ float dl = luma(texture(tBase, uv*.6+.2+vec2(sin(uTime*.5)*.05,0.)).rgb); uv += (dl-.5)*uDisp*vec2(.06,.035); }
  if(uRoll>0.){ uv.y = fract(uv.y + fract(uTime*(.3+uRoll))*uRoll*1.2); float band = smoothstep(.0,.08,abs(fract(uv.y+uTime*.5)-.5)); uv.x += (1.-band)*uRoll*.05*sin(uTime*40.); }
  if(uSlice>0.){ float vert = step(.5, V6); float ax = mix(uv.y*uRes.y, uv.x*uRes.x, vert);
    float sl = floor(ax/mix(60.,8.,uSlice)); float hs = hash(vec2(sl,tq+uSeed));
    if(hs > 1.-uSlice*.5){ if(vert>.5) uv.y += (hs-.5)*uSlice*.5; else uv.x += (hs-.5)*uSlice*.5; } }
  // organic tear: feathered noise bands shoved sideways
  if(uTear>0.){ float fv = floor(V1*3.);
    if(fv<1.){ float tn = fbm(vec2(uv.y*mix(3.,9.,V5)+uSeed, tq*.9)); float m = smoothstep(1.-uTear*.55, 1.-uTear*.55+.08, tn);
      uv.x += m*(fbm(vec2(uv.y*25., tq))-.5)*uTear*.5; uv.y += m*(hash(vec2(tq,uSeed))-.5)*uTear*.05; }
    else if(fv<2.){ float tn = fbm(vec2(uv.x*mix(4.,11.,V5)+uSeed, tq*.8)); float m = smoothstep(1.-uTear*.5, 1.-uTear*.5+.07, tn);
      uv.y += m*(fbm(vec2(uv.x*22., tq+3.))-.5)*uTear*.45; uv.x += m*(hash(vec2(tq+5.,uSeed))-.5)*uTear*.04; }
    else { vec2 cl = floor(uv*vec2(mix(3.,7.,V5), mix(5.,11.,V6))); float h = hash(cl+tq*.41+uSeed);
      if(h > 1.-uTear*.45) uv += (vec2(hash(cl+1.7), hash(cl+4.3))-.5)*uTear*.22; } }
  if(uMelt>0.){ // columns sag: drip length varies per column, pulled toward dark or bright per cut
    float cn = fbm(vec2(uv.x*mix(7.,22.,V5)+uSeed, 3.1));
    float lm = luma(texture(tBase, clamp(uv,0.,1.)).rgb);
    float amt = uMelt*(.05+.13*cn)*mix(1.-lm, lm, step(.5,V7));
    vec2 mdir = V2<.34 ? vec2(0.,-1.) : V2<.67 ? vec2(0.,1.) : vec2(.34,-.94);
    uv += mdir*amt*smoothstep(0.,.55,fract(uv.y*1.3+uTime*.05)); }
  if(uShock>0. && uShockT<.6){ vec2 ctr = vec2(.25+.5*hash(vec2(uShockN,uSeed)), .25+.5*hash(vec2(uShockN+7.,uSeed))); vec2 dd = uv-ctr; float L = length(dd*vec2(asp,1.))+1e-4;
    float w = sin(L*46. - uShockT*22.)*exp(-L*4.5)*exp(-uShockT*6.); uv += (dd/L)*w*uShock*.07; }
  if(uTaffy>0.){ float nb = mix(6.,18.,V3); float b = floor(uv.y*nb); float h = hash(vec2(b, tq+uSeed)); float c0 = (b+.5)/nb;
    float k = mix(1., mix(.22, 3.2, h), uTaffy*step(.55,h)); uv.y = clamp(c0 + (uv.y-c0)*k, 0., 1.); }
  if(uSlit>0.){ float L = mix(.85,.25,V4) + sin(uTime*.6)*.07; float m2 = smoothstep(0.,.03,uv.y-L); uv.y = mix(uv.y, L, m2*uSlit); }
  if(uPix>1.){ float fv = floor(V2*3.); vec2 g = uRes/uPix;
    if(fv<1.) g = g; else if(fv<2.) g = vec2(g.x*mix(.35,.6,V4), g.y*mix(1.4,2.2,V5)); else g = vec2(g.x*mix(1.5,2.4,V6), g.y*mix(.4,.7,V7));
    uv = (floor(uv*g)+.5)/g; }
  // ---- sample ----
  float s = uSplit*.012*(1.+uPulse*1.5);
  vec2 rdir = normalize((vUv-.5)*vec2(asp,1.)+1e-4); vec2 sdir = V8<.34 ? vec2(1.,0.) : V8<.67 ? rdir : normalize(vec2(cos(V1*6.283), sin(V1*6.283)));
  vec3 base = sampleBase(uv, s, sdir);
  if(uBlur>0.){ vec3 acc = base; for(int i=1;i<10;i++){ float k = float(i)/9.; acc += sampleBase(mix(uv, vec2(.5), k*uBlur*.22), s, sdir); } base = acc/10.; }
  if(uSmear>0.){ vec2 dir = vec2(cos(uSmearA), sin(uSmearA))/uRes*13.; vec3 acc2 = base; for(int i=1;i<12;i++) acc2 += texture(tBase, uv+dir*float(i*i)*.42*uSmear).rgb; base = acc2/12.; }
  base = clamp(base - vec3(max(0., uThresh-.5)*.5) + vec3(max(0., .4-uThresh)*.15), 0., 1.);
  if(uGhost>0.){ float fv = floor(V3*3.); float ga = V7*6.2831 + uTime*.6;
    vec2 go = vec2(cos(ga), sin(ga))*uGhost*.045*(.55+V8);
    if(fv<1.){ vec3 g1 = texture(tBase, uv+go).rgb, g2 = texture(tBase, uv-go*1.7).rgb; base = mix(base, abs(base-g1)*1.3 + g2*.45, min(1.,uGhost)*.85); }
    else if(fv<2.){ vec3 tr2 = vec3(0.); vec2 dir = normalize(go+1e-4);
      for(int i=1;i<5;i++) tr2 += texture(tBase, uv - dir*float(i)*uGhost*.022).rgb*(1.-float(i)*.18);
      base = mix(base, max(base, tr2*.42), min(1.,uGhost)*.9); }
    else { vec3 d2 = texture(tBase, uv + vec2(go.y,-go.x)*2.1).rgb; base = mix(base, 1.-(1.-base)*(1.-d2*.8), min(1.,uGhost)*.7); } }
  if(uSort>0.){ // pixel sort: bright pixels pulled down along their bright run
    float th = mix(.72, .26, uSort) + (V6-.5)*.22; vec3 best = base; float bl = luma(base); bool run = true;
    float sv = floor(V4*4.); vec2 sdir2 = sv<1. ? vec2(0.,1.) : sv<2. ? vec2(0.,-1.) : sv<3. ? vec2(1.,0.) : vec2(.7,.7);
    vec2 step_ = sdir2/uRes*mix(3.,11.,uSort);
    for(int i=1;i<34;i++){ if(!run) break; vec3 sm = texture(tBase, uv+step_*float(i)).rgb; float l = luma(sm);
      if(l < th) run = false; else if(l > bl){ bl = l; best = sm; } }
    base = mix(base, best, smoothstep(th-.12, th+.06, luma(base))*step(.02,uSort));
  }
  // ---- look / color ----
  vec3 la = look(base, uLookA, uPalA, uThresh);
  if(uLookSwap>0.){ vec3 l2 = look(base, uLook2, uPal2, uThresh); la = mix(la, l2, uLookSwap); }
  vec3 col = mix(base, la, uLookMix);
  col = sat(col, uSat); col = (col-.5)*uCon+.5;
  if(uTone>0.){ float l = luma(col); vec3 ink = mix(uPalA[0], uPalA[3], smoothstep(uThresh-.08, uThresh+.08, l + (fbm(vUv*uRes*.02)-.5)*.25)); col = mix(col, ink, uTone); }
  if(uPoster>0.){ float lv = mix(24.,3.,uPoster); col = mix(col, floor(col*lv+.5)/lv, smoothstep(0.,.1,uPoster)); }
  if(uCorrupt>0.){ vec2 b2 = floor(uv*uRes/16.); float h1 = hash(b2+tq*.37+uSeed*3.); if(h1 > 1.-uCorrupt*.5){ float h2 = hash(b2+2.3);
    col = h2<.33 ? col.brg : h2<.66 ? col.gbr : clamp(col + (vec3(hash(b2+3.1),hash(b2+4.2),hash(b2+5.3))-.5)*.85, 0., 1.); } }
  if(pinW>.5) col = mix(col, uPalA[3]*(.3+.95*luma(base)), .72);
  if(pinF>.5) col = mix(uPalA[0], vec3(.96,.86,.48), smoothstep(.1,.8,luma(base)));
  if(uSplitOn>.5){ float co = uSplitDir<.5 ? vUv.x : 1.-vUv.y; bool tinted = (co < uSplitX) != (uSplitSide > .5);
    if(tinted){ float l = clamp((luma(base)-.06)*1.15, 0., 1.); if(uSplitPost>.5) l = floor(l*4. + bayer(gl_FragCoord.xy)*.99)/4.; col = gmap(l, uPalS); }
    else col = clamp((base-.5)*1.06+.5, 0., 1.); }
  if(uBandOn>.5){ float b=floor(vUv.y*uBandN); float hb=hash(vec2(b*1.31, uBandPh));
    float lb=clamp((luma(base)-.05)*1.18,0.,1.);
    float wch=floor(hb*4.); col = wch<1.? gmap(lb,uPalA) : wch<2.? gmap(lb,uPalB) : wch<3.? gmap(lb,uPal2) : gmap(lb,uPalS);
    col *= .86+.28*step(abs(b-uBandLit),.4); }
  if(uQuadOn>.5) col = treat(int(uQuadT[quadQ]), uv, base);
  if(uInsetOn>.5 && vUv.x>uInsetR.x && vUv.x<uInsetR.z && vUv.y>uInsetR.y && vUv.y<uInsetR.w) col = treat(int(uInsetT), uv, base);
  col *= 1.-uDim;
  if(uPattern>0.){ float m = smoothstep(uThresh-.07,uThresh+.07,luma(base)); m = mix(m,1.-m,uPatInv); vec4 pt = texture(tPat, vUv); col = mix(col, mix(pt.rgb, 1.-(1.-col)*(1.-pt.rgb), .5), pt.a*m*uPattern*.85); }
  if(uOverOn>.5){ vec4 ov = texture(tOver, uv); vec3 oc = vec3(texture(tOver,uv+vec2(s*.6,0.)).r, ov.g, texture(tOver,uv-vec2(s*.6,0.)).b);
    oc = ov.a>.99 ? look(oc, uLookB, uPalB, .5) : oc;
    if(uBlendMode>0) col = mix(col, blendMode(col, oc, uBlendMode), ov.a*uBlendAmt); else col = mix(col, oc, ov.a); }
  // ---- texture layer ----
  if(uEdges>0.){ vec2 e = 1.5/uRes; float l00=luma(texture(tBase,uv-e).rgb), l20=luma(texture(tBase,uv+vec2(e.x,-e.y)).rgb), l02=luma(texture(tBase,uv+vec2(-e.x,e.y)).rgb), l22=luma(texture(tBase,uv+e).rgb), l10=luma(texture(tBase,uv+vec2(0.,-e.y)).rgb), l12=luma(texture(tBase,uv+vec2(0.,e.y)).rgb), l01=luma(texture(tBase,uv+vec2(-e.x,0.)).rgb), l21=luma(texture(tBase,uv+vec2(e.x,0.)).rgb);
    float gx = -l00-2.*l01-l02+l20+2.*l21+l22, gy = -l00-2.*l10-l20+l02+2.*l12+l22; float g = clamp(length(vec2(gx,gy))*2.5,0.,1.);
    float fv = floor(V1*3.);
    if(fv<1.){ vec3 ec = gmap(fract(uv.y*.6+uTime*.1), uPalA); col = mix(col, col*(1.-uEdges*.6) + ec*g*2., uEdges); }
    else if(fv<2.){ float ink = smoothstep(.25,.65,g); col = mix(col, mix(col, uPalA[0], ink), uEdges); }
    else { vec3 ec = gmap(fract(g*1.6+uTime*.2), uPalA); col = mix(col, ec*smoothstep(.1,.7,g)*1.8, uEdges*.9); } }
  if(uGlow>0.){ float fv = floor(V8*3.); vec3 gsum = vec3(0.);
    if(fv<1.){ for(int i=0;i<8;i++){ float a = float(i)*.7854; vec2 off = vec2(cos(a),sin(a)*asp); gsum += max(texture(tBase,uv+off*.012).rgb-.55,0.) + max(texture(tBase,uv+off*.03).rgb-.55,0.); } gsum /= 16.; }
    else if(fv<2.){ for(int i=1;i<9;i++){ float k = float(i)*.009; gsum += max(texture(tBase,uv+vec2(k,0.)).rgb-.5,0.) + max(texture(tBase,uv-vec2(k,0.)).rgb-.5,0.); }
      gsum /= 16.; gsum *= vec3(.55,.75,1.5); }
    else { for(int i=1;i<9;i++){ float k = float(i)*.007; gsum += max(texture(tBase,uv+vec2(0.,k)).rgb-.52,0.) + max(texture(tBase,uv-vec2(0.,k)).rgb-.52,0.); } gsum /= 15.; }
    col += gsum*uGlow*2.2*(1.+uPulse); }
  if(uRings>0.){ float fv = floor(V6*3.); vec2 ctr2 = vec2(.5,.45) + (vec2(V7,V8)-.5)*.3;
    vec2 q = (vUv-ctr2)*vec2(asp,1.); float d = length(q), an2 = atan(q.y,q.x), r;
    if(fv<1.){ r = smoothstep(.55,1.,.5+.5*sin(d*mix(55.,110.,V1)-uTime*7.)); }
    else if(fv<2.){ r = smoothstep(.55,1.,.5+.5*sin(d*48.+an2*mix(3.,9.,V2)-uTime*5.)); }
    else { float m1 = sin(d*70.-uTime*6.), m2 = sin((d*62.+an2*2.)+uTime*4.); r = smoothstep(.5,1.,.5+.5*m1*m2); }
    vec3 rc = gmap(fract(d*2.5-uTime*.25), uPalA); col = 1.-(1.-col)*(1.-rc*r*uRings*.55*(1.-smoothstep(.2,.75,d)*.5)); }
  if(uLeak>0.){ float fv = floor(V7*3.); float d;
    if(fv<1.){ vec2 lc = vec2(step(.5,V1), step(.5,V2)); d = 1.-smoothstep(0., 1.1, distance(vUv*vec2(asp,1.), lc*vec2(asp,1.))); d *= d; }
    else if(fv<2.){ float edge = V3<.5 ? vUv.y : 1.-vUv.y; d = pow(1.-smoothstep(0.,mix(.3,.75,V4),edge), 1.6); }
    else { vec2 fc = vec2(mix(.15,.85,V4), mix(.15,.85,V5)); float dl = distance(vUv*vec2(asp,1.), fc*vec2(asp,1.));
      d = exp(-dl*mix(3.,7.,V6))*1.1 + exp(-abs(vUv.y-fc.y)*mix(18.,45.,V8))*.45; }
    vec3 lk = gmap(fract(uVar+uTime*.1), uPalB)*1.4; col = 1.-(1.-col)*(1.-lk*d*uLeak); }
  if(uOil>0.){ vec2 e2 = 2./uRes; float gx = luma(texture(tBase,uv+vec2(e2.x,0.)).rgb)-luma(texture(tBase,uv-vec2(e2.x,0.)).rgb), gy = luma(texture(tBase,uv+vec2(0.,e2.y)).rgb)-luma(texture(tBase,uv-vec2(0.,e2.y)).rgb);
    float ang = atan(gy, gx), l2 = luma(col); vec3 ir = .5+.5*cos(vec3(0.,2.1,4.2)+ang*2.+l2*9.+uTime*.8); col = mix(col, ir*(.3+l2), uOil*smoothstep(.015,.12,length(vec2(gx,gy)))); }
  if(uContour>0.){ float l3 = luma(col)*mix(5.,12.,V6); float line = smoothstep(.14,.03,abs(fract(l3)-.5)); col = mix(col, uPalA[3], line*uContour*.9); }
  if(uHalf>0.){ float fv = floor(V5*3.); float ha = mix(.2,1.3,V6); float cs = cos(ha), sn = sin(ha);
    vec2 gr = vUv*uRes/mix(14.,6.,uHalf); gr = vec2(gr.x*cs-gr.y*sn, gr.x*sn+gr.y*cs);
    float l = luma(col), ink;
    if(fv<1.){ ink = smoothstep(l*.8, l*.8-.15, length(fract(gr)-.5)); }
    else if(fv<2.){ ink = smoothstep(l*.85, l*.85-.22, abs(fract(gr.y)-.5)*2.); }
    else { float a1 = abs(fract(gr.y)-.5)*2., a2 = abs(fract(gr.x)-.5)*2.; ink = smoothstep(l*.95, l*.95-.3, min(a1,a2)); }
    col = mix(col, mix(uPalA[0], col*1.3, ink), uHalf); }
  if(uDither>0.){ float b = bayer(gl_FragCoord.xy); vec3 d1 = step(vec3(b), col); col = mix(col, d1, uDither); }
  if(uLed>0.){ float cell = mix(90.,26.,uLed)*mix(.75,1.35,V4); vec2 g = vUv*vec2(asp,1.)*cell; vec2 cuv = (floor(g)+.5)/cell; vec3 sm2 = texture(tBase, vec2(cuv.x/asp, cuv.y)).rgb;
    float dot2 = smoothstep(.46,.3,length(fract(g)-.5)); col = mix(col, sm2*dot2*1.55, uLed); }
  if(uWeave>0.){ float cw = mix(42.,9.,V5); float colId = floor(vUv.x*cw); if(hash(vec2(colId, uSeed)) < uWeave*.6) col = texture(tPrev, uv).rgb; }
  // ---- feedback / melt ----
  if(uFeed>0. || uMelt>0.){ vec3 pv = texture(tPrev, (vUv-.5)*(1.-.014*uFeed)+.5).rgb; col = mix(col, max(col, pv*.82), uFeed*.9);
    if(uMelt>0.){ vec2 grain = V2<.34 ? vec2(4.,2.) : V2<.67 ? vec2(2.,5.) : vec2(3.,3.);
      vec2 flow = V2<.34 ? vec2(0.,-1.) : V2<.67 ? vec2(1.,-.25) : vec2(0.,1.);
      float mn = fbm(vUv*grain+tq*.13+uSeed);
      float m = smoothstep(.42, .62, mn)*uMelt;   // fbm sits near .5, so the old .7 gate almost never opened
      vec3 mv = texture(tPrev, vUv + flow*uMelt*.05*mn).rgb; col = mix(col, max(col*.55, mv), m*.75); } }
  // ---- frame mechanisms: crisp borders and the eroded box, after feedback so they never smear ----
  if(uQuadOn>.5){ vec2 g = abs(vUv-.5); float w = 2.5/uRes.x, wy = 2.5/uRes.y; if(g.x < w || g.y < wy || vUv.x < w || vUv.x > 1.-w || vUv.y < wy || vUv.y > 1.-wy) col = uPalS[3]; }
  if(uInsetOn>.5){ vec4 r = uInsetR; float bw = 3./uRes.x, bh = 3./uRes.y; bool outer = vUv.x>r.x-bw && vUv.x<r.z+bw && vUv.y>r.y-bh && vUv.y<r.w+bh, inner = vUv.x>r.x && vUv.x<r.z && vUv.y>r.y && vUv.y<r.w; if(outer && !inner) col = vec3(1.); }
  if(uErodeOn>.5){ vec2 bs = vec2(26., 26./asp), bc = floor(vUv*bs), bf = (bc+.5)/bs, m = uErodeM;
    float d = max(max(m.x - bf.x, bf.x - (1.-m.x))*bs.x, max(m.y - bf.y, bf.y - (1.-m.y))*bs.y);      // blocks outside the box > 0, inside < 0
    float h = hash(bc + floor(uTime*.25)*7.31 + uSeed);
    bool keep = d <= 0. ? !(d > -1.6 && h < .22) : h < .55*exp(-d*.8);                                   // edges eaten in, fragments left out
    float dg = vUv.x*asp - vUv.y + (uErodeB-.5)*1.2;
    if(abs(dg - .35) < .07) col = mix(uPalS[2], uPalS[3], step(.5 + (bayer(gl_FragCoord.xy)-.5)*.3, luma(base)));   // the diagonal band
    else if(!keep) col = vec3(0.); }
  if(uPinOn>.5){ vec2 pm = uPinM, pbs = vec2(6., 6.*uRes.y/uRes.x), pbc = floor(vUv*pbs); float pe = min(min(vUv.x-pm.x, 1.-pm.x-vUv.x)*uRes.x, min(vUv.y-pm.y, 1.-pm.y-vUv.y)*uRes.y)/uRes.x, phb = hash(pbc + uPinChunk*13.1 + uSeed);
    // a few big notches: blocks that spill past the box edge, and the odd block bitten out of it
    if(pe <= 0. && !(pe > -.7/pbs.x && phb < .2)) col = vec3(0.); else if(pe > 0. && pe < .6/pbs.x && phb > .9) col = vec3(0.); }
  if(uPanelOn>.5 && vUv.x>=uPanelR.x && vUv.x<=uPanelR.z && vUv.y>=uPanelR.y && vUv.y<=uPanelR.w) col = uPanelC;
  if(uStripOn>.5) col = iceStrip(col);
  if(uRefOn>.5) col = refFx(col, base, uv);
  if(uPixHold>0.){ float xq=floor(vUv.x*uRes.x*.5)/(uRes.x*.5); vec3 pb=texture(tBase, vec2(xq, uPixRow)).rgb; float pl=smoothstep(.08,.9,luma(pb)); col = mix(col, gmap(pl,uPalA)*(.5+.7*pl), uPixHold); }
  if(uLoupeOn>.5){ vec2 lq=(vUv-uLoupeC)*vec2(asp,1.); float ld=length(lq), lw=1.6/uRes.y;
    if(abs(ld-uLoupeR)<lw*2.2) col=uPalA[3]; else if(ld<uLoupeR && uLoupeR-ld<lw*8.) col*=.5;
    if(ld>uLoupeR+lw*3. && (abs(vUv.x-uLoupeC.x)*uRes.x<1.2 || abs(vUv.y-uLoupeC.y)*uRes.y<1.2)) col=mix(col,uPalA[3],.55); }
  // ---- text ----
  vec2 to = vec2(uTextSplit*.009*(1.+uPulse*2.), 0.);
  vec4 tr = texture(tText, vUv+to), tg = texture(tText, vUv), tb = texture(tText, vUv-to);
  if(uTextOn<.5){}
  else if(uTextMode==0){ vec3 tc = vec3(tr.r,tg.g,tb.b); vec3 scr = 1.-(1.-col)*(1.-tc); vec3 tcol = mix(tc, scr, .45); vec3 ta = vec3(tr.a,tg.a,tb.a)*uTextAlpha; col = mix(col, tcol, ta); }
  else if(uTextMode==1){ vec2 fu = vUv*.75+.12+vec2(sin(uTime*.4)*.06, uTime*.03); vec3 f = sat(hueShift(look(texture(tBase,fu).rgb, 2, uPalB, .5), 1.6+uHue*.3),1.6); col.r = mix(col.r,f.r,tr.a); col.g = mix(col.g,f.g,tg.a); col.b = mix(col.b,f.b,tb.a); }
  else { col.r = mix(col.r,1.-col.r,tr.a); col.g = mix(col.g,1.-col.g,tg.a); col.b = mix(col.b,1.-col.b,tb.a); }
  if(uBands>.2){ float nb = floor(mix(3.,14.,B1)); float b = step(.5, fract(vUv.y*nb + hash(vec2(tq,uSeed)))); col = mix(col, 1.-col, b*smoothstep(.25,.55,uBands)); }
  if(uScan>0.){
    col *= 1.-uScan*.32*(.5+.5*sin(vUv.y*uRes.y*mix(.9,2.6,V4)));
    // chroma lags luma the way tape does
    float cb = uScan*.012*(1.+V2*2.5)*mix(-1.,1.,step(.5,V5)); vec3 bl = texture(tBase, uv+vec2(cb,0.)).rgb;
    col = mix(col, vec3(col.r*.65+bl.r*.35, col.g, col.b*.65+bl.b*.35), uScan*.55);
    if(hash(vec2(floor(vUv.y*90.),tq)) > .985) col = mix(col, vec3(luma(col)*1.3), .6*uScan);
    float sw = mix(.02,.11,V3); // head switch: the torn strip at the very bottom of a VHS frame
    if(vUv.y < sw){ float k = 1.-vUv.y/sw; vec3 tn2 = texture(tBase, uv+vec2((hash(vec2(tq,floor(vUv.y*220.)))-.5)*.09*k, 0.)).rgb;
      col = mix(col, mix(tn2, vec3(hash(vUv*uRes+tq)), .35*k), uScan*k*.9); } }
  if(uVeil>0.){ float lv2 = luma(col); float nz = hash(vUv*uRes + fract(uTime*9.)*113.); col = mix(col, vec3(nz*nz*1.2), uVeil*smoothstep(.5,.06,lv2)); }
  col += (hash(vUv*uRes+fract(uTime*7.)*91.)-.5)*uGrain*.28;
  o = vec4(clamp(col,0.,1.),1.);
}`;
const FS_COPY = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float fInvert, fFlash, fBlack;
void main(){ vec3 c = texture(t, vUv).rgb; c = mix(c, 1.-c, fInvert); c = mix(c, vec3(1.), fFlash); c *= 1.-fBlack; o = vec4(c,1.); }`;
