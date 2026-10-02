/* Google AdMob bridge (Android/iOS via @capacitor-community/admob). In a normal browser the dev mock in core.js is used. */
(function () {
  const C = window.Capacitor; if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const A = C.Plugins && C.Plugins.AdMob; if (!A) { console.warn('AdMob plugin missing'); return; }
  const cfg = CM.ADS; let initP = null;
  const init = () => initP || (initP = (async () => {
    try { await A.initialize({ initializeForTesting: cfg.testMode }); } catch (e) { console.warn('admob init', e); }
    try { const info = await A.requestConsentInfo(); if (info && info.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm(); } catch (e) {}
  })());
  const listen = async (list, ev, fn) => { try { list.push(await A.addListener(ev, fn)); } catch (e) {} };
  const cleanup = list => list.forEach(h => { try { h.remove(); } catch (e) {} });
  // Ads are pre-loaded in the background so showing one is instant (no "hang" while it loads).
  const st = { r: false, rBusy: false, i: false, iBusy: false };
  async function loadR() { if (st.r || st.rBusy) return; st.rBusy = true; try { await A.prepareRewardVideoAd({ adId: cfg.id('rewarded'), isTesting: cfg.testMode }); st.r = true; } catch (e) { setTimeout(loadR, 15000); } st.rBusy = false; }
  async function loadI() { if (st.i || st.iBusy) return; st.iBusy = true; try { await A.prepareInterstitial({ adId: cfg.id('interstitial'), isTesting: cfg.testMode }); st.i = true; } catch (e) { setTimeout(loadI, 15000); } st.iBusy = false; }
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  CM.ads.setProvider({
    async rewarded() {
      await init(); let ok = false; const hs = [];
      await listen(hs, 'onRewardedVideoAdReward', () => { ok = true; });
      const dismissed = new Promise(res => { listen(hs, 'onRewardedVideoAdDismissed', () => setTimeout(res, 100)); listen(hs, 'onRewardedVideoAdFailedToShow', () => res()); });
      try {
        if (!st.r) { loadR(); const t0 = Date.now(); while (!st.r && Date.now() - t0 < 8000) await new Promise(r => setTimeout(r, 150)); }
        if (st.r) { st.r = false; CM.audio.suspend(true); await A.showRewardVideoAd(); await withTimeout(dismissed, 120000); }
      } catch (e) { console.warn('rewarded', e); }
      CM.audio.suspend(false); cleanup(hs); setTimeout(loadR, 800); return ok;
    },
    async interstitial() {
      await init(); const hs = [];
      const dismissed = new Promise(res => { listen(hs, 'onInterstitialAdDismissed', () => setTimeout(res, 100)); listen(hs, 'onInterstitialAdFailedToShow', () => res()); });
      try { if (st.i) { st.i = false; CM.audio.suspend(true); await A.showInterstitial(); await withTimeout(dismissed, 120000); } } catch (e) { console.warn('interstitial', e); }
      CM.audio.suspend(false); cleanup(hs); setTimeout(loadI, 800);
    }
  });
  init().then(() => { loadR(); loadI(); });
})();
