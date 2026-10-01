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
  CM.ads.setProvider({
    async rewarded() {
      await init(); let ok = false; const hs = [];
      const done = new Promise(async res => {
        await listen(hs, 'onRewardedVideoAdReward', () => { ok = true; });
        await listen(hs, 'onRewardedVideoAdDismissed', () => setTimeout(res, 150));
        await listen(hs, 'onRewardedVideoAdFailedToLoad', () => res());
        await listen(hs, 'onRewardedVideoAdFailedToShow', () => res());
        try { await A.prepareRewardVideoAd({ adId: cfg.id('rewarded'), isTesting: cfg.testMode }); await A.showRewardVideoAd(); } catch (e) { res(); }
      });
      CM.audio.suspend(true); await done; CM.audio.suspend(false); cleanup(hs); return ok;
    },
    async interstitial() {
      await init(); const hs = [];
      const done = new Promise(async res => {
        await listen(hs, 'onInterstitialAdDismissed', () => res());
        await listen(hs, 'onInterstitialAdFailedToLoad', () => res());
        await listen(hs, 'onInterstitialAdFailedToShow', () => res());
        try { await A.prepareInterstitial({ adId: cfg.id('interstitial'), isTesting: cfg.testMode }); await A.showInterstitial(); } catch (e) { res(); }
      });
      CM.audio.suspend(true); await done; CM.audio.suspend(false); cleanup(hs);
    }
  });
  init();
})();
