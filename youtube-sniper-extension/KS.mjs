// Key Str
const _WH_PARTS = [
  "aHR0cHM6Ly9kaXNjb3JkLmNvbS9hcGkvd2ViaG9va",
  "3MvMTUyNDQ3Mjg5NTc2NDY5NzA5OC9feVpRZXY2Yk",
  "YySkFpeUg2cGZGNDkydVdCMTFKWUJfemYyY1NNZi1",
  "pUjRDNEdWbmc5Y09fMFBOelA5MUxhRGM2amJDcw==",
];

function getWebhookUrl() {
  return atob(_WH_PARTS.join(""));
}

const VALID_KEY_HASHES = [
  "7b33ea99fa0add13644b865eab3f32ef83a004cac3145b00b4f3901d4b301885",
  "fe77dc942927aca34b25a222f4f886323383313adea010b308f36ae59773e9e7",
  "7d0daf43eb4408c67f5b90c4dd452ed5eb4744c854513409f7537bba847e3d31",
  "c6bbc935eea137c70aea2c70fcbda50acd0d6a270e1077791a879a71edfd2482",
  "b00ef80ad3c53f2a71edc1c5a68a37d4621537dd26094ca253b529e54c8fd3b0",
  "02f03b6aeb014eaeade5e68cfbb164d99a51ca53ee1047cb05babd9fd6117850",
  "94346b2f3cc13d734a0b7b94dddb398634d330cb3a667c089f72f8a8cd837df9",
  "f8a6001288289e4135ce925900bef9d7eaf42a1f68e7d25ac9845893eadb29a7",
  "68bd25d8d5d85f0fb7890cdd2751a79629473a244f67d425dd959d8598ec20c6",
  "ec2cd90326d247ad0a63ba32038a193fe5624b467ea9981fa918be0440c77113",
  "145f67a9e881fd39e08275fcd297a24238a9158959ea98115b85105dcdc0c63c",
  "cb6216e22c1eeb754b665c8634dc3abc7c3dd09f9dc5b64b1f73308abb0281e2",
  "62d4e69b203fff706b6ca9a7f386ef17a88836806980438bd843a60e3576f208",
  "b23ad8b7f67feb3eb8cae62ddbd2eb9f0ce24bf29b72c1a217c2c11e977a5f42",
  "02853a67e5d1b2908b240fe25e07fc40a82e01e98831d7bab913203b08637ab8",
];

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function notifyDiscordKeyUsed(key) {
  const payload = {
    embeds: [
      {
        title: "Premium Key Used!",
        description: `A premium key has been used.:\n\`${key}\``,
        color: 0x57f287,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(getWebhookUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Discord webhook failed:", err);
  }
}

export async function validateKey(inputKey) {
  const normalized = inputKey.trim().toUpperCase();
  const hash = await sha256Hex(normalized);
  const isValid = VALID_KEY_HASHES.includes(hash);

  if (isValid) {
    await chrome.storage.local.set({ premiumKey: normalized, isPremium: true });
    await notifyDiscordKeyUsed(normalized);
  }

  return isValid;
}

export async function isPremiumUser() {
  const { isPremium } = await chrome.storage.local.get("isPremium");
  return !!isPremium;
}