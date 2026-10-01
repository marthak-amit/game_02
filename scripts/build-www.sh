#!/bin/sh
# Copies the static game into www/ for Capacitor (then: npx cap add android && npx cap sync android)
rm -rf www && mkdir www && cp -r index.html privacy.html manifest.json sw.js css js icons www/
