// Overlays app.json. Set HERMIONE_ANDROID_PACKAGE (for example in an untracked .env.local) to build
// under your own application ID; the committed default is a placeholder.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, package: process.env.HERMIONE_ANDROID_PACKAGE || config.android.package },
});
