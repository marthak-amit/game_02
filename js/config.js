/* ---------------------------------------------------------------------------
 * AD CONFIG – edit this file when you get your real AdMob IDs.
 *  1. Set testMode:false
 *  2. Fill the "prod" ad unit IDs below (AdMob console → Apps → Ad units)
 *  3. Put your real App ID in android/app/src/main/AndroidManifest.xml
 *     (meta-data com.google.android.gms.ads.APPLICATION_ID) – currently Google's TEST app id.
 * While testMode is true (or a prod id is empty) Google's official test ads are used.
 * ------------------------------------------------------------------------- */
CM.ADS = {
  testMode: true,
  appId: { test: 'ca-app-pub-3940256099942544~3347511713', prod: '' },
  rewarded: { test: 'ca-app-pub-3940256099942544/5224354917', prod: '' },
  interstitial: { test: 'ca-app-pub-3940256099942544/1033173712', prod: '' },
  banner: { test: 'ca-app-pub-3940256099942544/6300978111', prod: '' },
  id(kind) { const k = this[kind]; return (this.testMode || !k.prod) ? k.test : k.prod; }
};
