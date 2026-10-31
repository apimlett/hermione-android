#!/usr/bin/env bash
# Local Android build: no EAS account, uploads, cloud build or live Hermes changes.
set -euo pipefail
cd "$(dirname "$0")/.."
# Optional untracked local overrides, e.g. HERMIONE_ANDROID_PACKAGE.
if [ -f .env.local ]; then set -a; . ./.env.local; set +a; fi
TOOLS="${HERMIONE_TOOLCHAINS:-$HOME/.local/share/hermione-toolchains}"
export JAVA_HOME="${JAVA_HOME:-$TOOLS/java17}"
export ANDROID_HOME="${ANDROID_HOME:-$TOOLS/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1
./node_modules/.bin/tsc --noEmit
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test test/poc-*.test.mjs
./node_modules/.bin/expo prebuild --platform android --no-install
cd android
./gradlew assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
printf '\nPrivate POC APK: %s/android/app/build/outputs/apk/release/app-release.apk\n' "$(dirname "$PWD")"
