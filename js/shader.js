/* Glitch Reel Machine — GLSL effect chain */
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
  uEdges, uHalf, uDither, uLookSwap, uBlur, uDisp, uLeak, uBlendAmt, uTone, uTextAlpha, uPolar, uGhost, uBands;
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
  return clamp(c,0.,1.);
}
float bayer(vec2 p){ ivec2 i = ivec2(mod(p,4.)); int m[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return float(m[i.y*4+i.x])/16.; }
vec3 sampleBase(vec2 uv, float s, vec2 dir){ return vec3(texture(tBase,uv+dir*s).r, texture(tBase,uv).g, texture(tBase,uv-dir*s).b); }
vec3 blendMode(vec3 a, vec3 b, int m){
  if(m==1) return 1.-(1.-a)*(1.-b);           // screen
  if(m==2) return abs(a-b);                   // difference
  if(m==3) return a*b*1.6;                    // multiply (lifted)
  if(m==4) return max(a,b);                   // lighten
  if(m==5) return mix(2.*a*b, 1.-2.*(1.-a)*(1.-b), step(.5,a)); // overlay
  return b;
}
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y; float tq = floor(uTime*12.);
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
  if(uSlice>0.){ float sl = floor(uv.y*uRes.y/mix(60.,8.,uSlice)); float hs = hash(vec2(sl,tq+uSeed)); if(hs > 1.-uSlice*.5) uv.x += (hs-.5)*uSlice*.5; }
  // organic tear: feathered noise bands shoved sideways
  if(uTear>0.){ float tn = fbm(vec2(uv.y*5.+uSeed, tq*.9)); float m = smoothstep(1.-uTear*.55, 1.-uTear*.55+.08, tn); uv.x += m*(fbm(vec2(uv.y*25., tq))-.5)*uTear*.5; uv.y += m*(hash(vec2(tq,uSeed))-.5)*uTear*.05; }
  if(uPix>1.){ vec2 g = uRes/uPix; uv = (floor(uv*g)+.5)/g; }
  // ---- sample ----
  float s = uSplit*.012*(1.+uPulse*1.5);
  vec2 rdir = normalize((vUv-.5)*vec2(asp,1.)+1e-4); vec2 sdir = mix(vec2(1.,0.), rdir, step(.5, fract(uSeed*3.1)));
  vec3 base = sampleBase(uv, s, sdir);
  if(uBlur>0.){ vec3 acc = base; for(int i=1;i<10;i++){ float k = float(i)/9.; acc += sampleBase(mix(uv, vec2(.5), k*uBlur*.22), s, sdir); } base = acc/10.; }
  base = clamp(base - vec3(max(0., uThresh-.5)*.5) + vec3(max(0., .4-uThresh)*.15), 0., 1.);
  if(uGhost>0.){ vec2 go = vec2(sin(uTime*3.1+uSeed), cos(uTime*2.3))*uGhost*.045; vec3 g1 = texture(tBase, uv+go).rgb, g2 = texture(tBase, uv-go*1.7).rgb; base = mix(base, abs(base-g1)*1.3 + g2*.45, min(1.,uGhost)*.85); }
  if(uSort>0.){ // pixel sort: bright pixels pulled down along their bright run
    float th = 1.-uSort*.55; vec3 best = base; float bl = luma(base); bool run = bl > th; vec2 step_ = vec2(0., 1./uRes.y*mix(2.,6.,uSort));
    for(int i=1;i<24;i++){ if(!run) break; vec3 sm = texture(tBase, uv+step_*float(i)).rgb; float l = luma(sm); if(l < th){ run = false; } else if(l > bl){ bl = l; best = sm; } }
    base = mix(base, best, smoothstep(th, th+.15, luma(base))*step(.02,uSort));
  }
  // ---- look / color ----
  vec3 la = look(base, uLookA, uPalA, uThresh);
  if(uLookSwap>0.){ vec3 l2 = look(base, uLook2, uPal2, uThresh); la = mix(la, l2, uLookSwap); }
  vec3 col = mix(base, la, uLookMix);
  col = sat(col, uSat); col = (col-.5)*uCon+.5;
  if(uTone>0.){ float l = luma(col); vec3 ink = mix(uPalA[0], uPalA[3], smoothstep(uThresh-.08, uThresh+.08, l + (fbm(vUv*uRes*.02)-.5)*.25)); col = mix(col, ink, uTone); }
  if(uPoster>0.){ float lv = mix(24.,3.,uPoster); col = mix(col, floor(col*lv+.5)/lv, smoothstep(0.,.1,uPoster)); }
  col *= 1.-uDim;
  if(uPattern>0.){ float m = smoothstep(uThresh-.07,uThresh+.07,luma(base)); m = mix(m,1.-m,uPatInv); vec4 pt = texture(tPat, vUv); col = mix(col, mix(pt.rgb, 1.-(1.-col)*(1.-pt.rgb), .5), pt.a*m*uPattern*.85); }
  if(uOverOn>.5){ vec4 ov = texture(tOver, uv); vec3 oc = vec3(texture(tOver,uv+vec2(s*.6,0.)).r, ov.g, texture(tOver,uv-vec2(s*.6,0.)).b);
    oc = ov.a>.99 ? look(oc, uLookB, uPalB, .5) : oc;
    if(uBlendMode>0) col = mix(col, blendMode(col, oc, uBlendMode), ov.a*uBlendAmt); else col = mix(col, oc, ov.a); }
  // ---- texture layer ----
  if(uEdges>0.){ vec2 e = 1.5/uRes; float l00=luma(texture(tBase,uv-e).rgb), l20=luma(texture(tBase,uv+vec2(e.x,-e.y)).rgb), l02=luma(texture(tBase,uv+vec2(-e.x,e.y)).rgb), l22=luma(texture(tBase,uv+e).rgb), l10=luma(texture(tBase,uv+vec2(0.,-e.y)).rgb), l12=luma(texture(tBase,uv+vec2(0.,e.y)).rgb), l01=luma(texture(tBase,uv+vec2(-e.x,0.)).rgb), l21=luma(texture(tBase,uv+vec2(e.x,0.)).rgb);
    float gx = -l00-2.*l01-l02+l20+2.*l21+l22, gy = -l00-2.*l10-l20+l02+2.*l12+l22; float g = clamp(length(vec2(gx,gy))*2.5,0.,1.);
    vec3 ec = gmap(fract(uv.y*.6+uTime*.1), uPalA); col = mix(col, col*(1.-uEdges*.6) + ec*g*2., uEdges); }
  if(uGlow>0.){ vec3 gsum = vec3(0.); for(int i=0;i<8;i++){ float a = float(i)*.7854; vec2 off = vec2(cos(a),sin(a)*asp); gsum += max(texture(tBase,uv+off*.012).rgb-.55,0.) + max(texture(tBase,uv+off*.03).rgb-.55,0.); } col += gsum/16.*uGlow*2.2*(1.+uPulse); }
  if(uRings>0.){ vec2 q = (vUv-vec2(.5,.45))*vec2(asp,1.); float d = length(q); float r = smoothstep(.55,1.,.5+.5*sin(d*85.-uTime*7.)); vec3 rc = gmap(fract(d*2.5-uTime*.25), uPalA); col = 1.-(1.-col)*(1.-rc*r*uRings*.55*(1.-smoothstep(.2,.75,d)*.5)); }
  if(uLeak>0.){ vec2 lc = vec2(step(.5,fract(uSeed*7.7)), step(.5,fract(uSeed*3.3))); float d = 1.-smoothstep(0., 1.1, distance(vUv*vec2(asp,1.), lc*vec2(asp,1.))); vec3 lk = gmap(fract(uSeed+uTime*.1), uPalB)*1.4; col = 1.-(1.-col)*(1.-lk*d*d*uLeak); }
  if(uHalf>0.){ vec2 g = vUv*uRes/mix(14.,6.,uHalf); vec2 cell = fract(g)-.5; float l = luma(col); float dot_ = smoothstep(l*.8, l*.8-.15, length(cell)); col = mix(col, mix(uPalA[0], col*1.3, dot_), uHalf); }
  if(uDither>0.){ float b = bayer(gl_FragCoord.xy); vec3 d1 = step(vec3(b), col); col = mix(col, d1, uDither); }
  // ---- feedback / melt ----
  if(uFeed>0. || uMelt>0.){ vec3 pv = texture(tPrev, (vUv-.5)*(1.-.014*uFeed)+.5).rgb; col = mix(col, max(col, pv*.82), uFeed*.9);
    if(uMelt>0.){ float mn = fbm(vec2(vUv.x*4., vUv.y*2.)+tq*.13+uSeed); float m = smoothstep(1.-uMelt*.5, 1.-uMelt*.5+.12, mn); vec3 mv = texture(tPrev, vUv + vec2((fbm(vUv*6.+tq)-.5)*.02, -uMelt*.04*mn)).rgb; col = mix(col, mv, m*.9); } }
  // ---- text ----
  vec2 to = vec2(uTextSplit*.009*(1.+uPulse*2.), 0.);
  vec4 tr = texture(tText, vUv+to), tg = texture(tText, vUv), tb = texture(tText, vUv-to);
  if(uTextOn<.5){}
  else if(uTextMode==0){ vec3 tc = vec3(tr.r,tg.g,tb.b); vec3 scr = 1.-(1.-col)*(1.-tc); vec3 tcol = mix(tc, scr, .45); vec3 ta = vec3(tr.a,tg.a,tb.a)*uTextAlpha; col = mix(col, tcol, ta); }
  else if(uTextMode==1){ vec2 fu = vUv*.75+.12+vec2(sin(uTime*.4)*.06, uTime*.03); vec3 f = sat(hueShift(look(texture(tBase,fu).rgb, 2, uPalB, .5), 1.6+uHue*.3),1.6); col.r = mix(col.r,f.r,tr.a); col.g = mix(col.g,f.g,tg.a); col.b = mix(col.b,f.b,tb.a); }
  else { col.r = mix(col.r,1.-col.r,tr.a); col.g = mix(col.g,1.-col.g,tg.a); col.b = mix(col.b,1.-col.b,tb.a); }
  if(uBands>.2){ float nb = floor(mix(3.,14.,fract(uSeed*5.3))); float b = step(.5, fract(vUv.y*nb + hash(vec2(tq,uSeed)))); col = mix(col, 1.-col, b*smoothstep(.25,.55,uBands)); }
  col *= 1.-uScan*.32*(.5+.5*sin(vUv.y*uRes.y*1.5708));
  if(uScan>0. && hash(vec2(floor(vUv.y*90.),tq)) > .985) col = mix(col, vec3(luma(col)*1.3), .6*uScan);
  col += (hash(vUv*uRes+fract(uTime*7.)*91.)-.5)*uGrain*.28;
  o = vec4(clamp(col,0.,1.),1.);
}`;
const FS_COPY = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D t; uniform float fInvert, fFlash, fBlack;
void main(){ vec3 c = texture(t, vUv).rgb; c = mix(c, 1.-c, fInvert); c = mix(c, vec3(1.), fFlash); c *= 1.-fBlack; o = vec4(c,1.); }`;
