// LUMA — Web Push public key.
// Generate a key pair once:   npx web-push generate-vapid-keys
// Put the PUBLIC key here (it is safe in client code); the PRIVATE key goes in the
// Edge Function's secrets only. Leave empty to keep push switched off.
window.LUMA_VAPID_PUBLIC_KEY = "";
