import numpy as np, json, glob
from scipy import signal
from scipy.io import wavfile
from scipy.optimize import minimize
SR=22050
prof=json.load(open('music/analysis/profile.json'))['balance_db']
bands={'sub_20_60':(20,60),'bass_60_150':(60,150),'lowmid_150_400':(150,400),'mid_400_2k':(400,2000),'himid_2k_6k':(2000,6000),'high_6k_11k':(6000,11025)}
roles=['kick','snare','hat','perc','bass','arp','pad','keys','lead','tex']
def bandpow(y):
    f,t,Z=signal.stft(y,fs=SR,nperseg=2048,noverlap=2048-220,window='hann',boundary=None,padded=False); P=(np.abs(Z)**2).sum(axis=1)
    return np.array([P[(f>=lo)&(f<hi)].sum() for lo,hi in bands.values()])
E={}
for r in roles:
    rows=[]
    for s in [1,2,3,4]:
        sr,y=wavfile.read(f'out/solo_s{s}_{r}.wav'); y=y/32768.0/4; rows.append(bandpow(y))
    E[r]=np.array(rows)
target=np.array([prof[k] for k in bands])
tp=10**(target/10); tp/=tp.sum()
def mixdb(g,seedi):
    tot=sum((g[i]**2)*E[r][seedi] for i,r in enumerate(roles)); tot=tot/tot.sum(); return 10*np.log10(tot+1e-12)
def cost(lg):
    g=np.exp(lg); c=0
    for si in range(4): c+=((mixdb(g,si)-10*np.log10(tp))**2).sum()
    c+=0.6*(lg**2).sum()   # stay near current gains
    return c
res=minimize(cost,np.zeros(len(roles)),method='Nelder-Mead',options={'maxiter':8000,'xatol':1e-4,'fatol':1e-4})
g=np.exp(res.x)
print('current mix (median over seeds):'); cur=np.median([mixdb(np.ones(len(roles)),si) for si in range(4)],axis=0)
for k,v,t in zip(bands,cur,target): print(f'  {k:16s} {v:7.2f}  target {t:7.2f}')
print('gain multipliers:'); 
for r,x in zip(roles,g): print(f'  {r:6s} x{x:5.2f}  ({20*np.log10(x):+5.1f} dB)')
new=np.median([mixdb(g,si) for si in range(4)],axis=0)
print('after:'); 
for k,v,t in zip(bands,new,target): print(f'  {k:16s} {v:7.2f}  target {t:7.2f}')
# per-role band share so we know who carries what
print('role band energy (dB rel. to its own total), median:')
for r in roles:
    e=np.median(E[r],axis=0); e=e/e.sum(); print(f'  {r:6s} '+' '.join(f'{10*np.log10(x+1e-12):6.1f}' for x in e))
