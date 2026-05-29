/**
 * RepoTracker License System — Option A Implementation
 *
 * Two validation modes:
 *
 * 1. ONLINE (production) — when LEMONSQUEEZY_API_KEY is set in .env:
 *    - Activation:   POST /v1/licenses/activate  → registers this machine, consumes 1 activation slot
 *    - Deactivation: POST /v1/licenses/deactivate → frees the slot so the user can move machines
 *    - Tier is determined by which Product ID the key belongs to
 *    - instance_id returned by LS is stored in config for later deactivation
 *
 * 2. OFFLINE (development / fallback) — when no API key is set:
 *    - Format-only validation (no LS API calls)
 *    - Key formats: RT-PRO-XXXX-XXXX-XXXX-XXXX  /  RT-TEAM-XXXX-XXXX-XXXX-XXXX
 *
 * Machine tracking: each install gets a stable random instanceId stored in data/meta.json.
 * This is what LS uses to count activations against the per-key limit.
 */

// ── Feature Sets ─────────────────────────────────────────────────────────────
export const PRO_FEATURES  = new Set(['ai_review', 'gist_sync', 'badges', 'export', 'pomodoro']);
export const TEAM_FEATURES = new Set(['team_mode', 'invite_tokens', 'lan_dashboard', 'team_standup']);

export const UPGRADE_URL  = 'https://repotracker.lemonsqueezy.com/buy/pro';
export const TEAM_URL     = 'https://repotracker.lemonsqueezy.com/buy/team';
export const WAITLIST_URL = 'https://tally.so/r/repotracker-team';

// ── Offline Key Format (development / fallback) ───────────────────────────────
const OFFLINE_KEY_REGEX = /^RT-(PRO|TEAM)-([A-Z0-9]{4}-){3}[A-Z0-9]{4}$/i;

function parseOfflineKey(key) {
  const trimmed = key.trim().toUpperCase();
  if (!OFFLINE_KEY_REGEX.test(trimmed)) {
    return { valid: false, tier: null, instanceId: null, error: 'Invalid key format. Expected RT-PRO-XXXX-XXXX-XXXX-XXXX or a LemonSqueezy license key.' };
  }
  const tier = trimmed.startsWith('RT-TEAM-') ? 'team' : 'pro';
  return { valid: true, tier, instanceId: null, error: null };
}

// ── LemonSqueezy Config ───────────────────────────────────────────────────────
const LS_API_KEY         = process.env.LEMONSQUEEZY_API_KEY || '';
const LS_PRO_PRODUCT_ID  = process.env.LEMONSQUEEZY_PRO_PRODUCT_ID || '';
const LS_TEAM_PRODUCT_ID = process.env.LEMONSQUEEZY_TEAM_PRODUCT_ID || '';

const LS_HEADERS = () => ({
  'Authorization': `Bearer ${LS_API_KEY}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'RepoTracker/0.2.0',
});

/**
 * Determine tier from LemonSqueezy product ID.
 * Returns 'pro' | 'team' | null (null = unknown product).
 */
function resolveTier(productId) {
  const pid = String(productId || '');
  if (!pid) return 'pro'; // no product IDs configured — default to pro
  if (LS_TEAM_PRODUCT_ID && pid === LS_TEAM_PRODUCT_ID) return 'team';
  if (LS_PRO_PRODUCT_ID  && pid === LS_PRO_PRODUCT_ID)  return 'pro';
  return null; // valid LS key but belongs to a different product
}

// ── LemonSqueezy: Activate ────────────────────────────────────────────────────
/**
 * Activate a license key for this machine.
 * Calls POST /v1/licenses/activate — consumes 1 activation slot.
 * Returns { valid, tier, instanceId, error }.
 */
export async function activateLicenseKey(key, instanceName) {
  if (!LS_API_KEY) return parseOfflineKey(key);

  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: LS_HEADERS(),
      body: JSON.stringify({
        license_key: key.trim(),
        instance_name: instanceName || 'RepoTracker',
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    // LS returns { activated: true, instance: { id, name }, license_key: { ... }, meta: { ... } }
    if (!data.activated) {
      // Check for activation limit exceeded
      const errMsg = data.error || '';
      if (errMsg.toLowerCase().includes('activation') || errMsg.toLowerCase().includes('limit')) {
        return {
          valid: false, tier: null, instanceId: null,
          error: 'This license key has reached its activation limit. Deactivate it on another machine first.',
        };
      }
      return {
        valid: false, tier: null, instanceId: null,
        error: errMsg || 'License key could not be activated.',
      };
    }

    const tier = resolveTier(data.meta?.product_id);
    if (!tier) {
      // Key activated successfully but belongs to a different product — deactivate immediately
      const instanceId = data.instance?.id;
      if (instanceId) await deactivateLicenseKey(key, instanceId).catch(() => {});
      return { valid: false, tier: null, instanceId: null, error: 'This key does not belong to a RepoTracker product.' };
    }

    return {
      valid: true,
      tier,
      instanceId: data.instance?.id || null,
      error: null,
    };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { valid: false, tier: null, instanceId: null, error: 'Could not reach LemonSqueezy. Check your internet connection and try again.' };
    }
    return { valid: false, tier: null, instanceId: null, error: `Activation failed: ${err.message}` };
  }
}

// ── LemonSqueezy: Deactivate ──────────────────────────────────────────────────
/**
 * Deactivate a license key for this machine, freeing the activation slot.
 * Calls POST /v1/licenses/deactivate.
 * Safe to call even if the key was already deactivated — returns ok either way.
 */
export async function deactivateLicenseKey(key, instanceId) {
  if (!LS_API_KEY || !instanceId) return { ok: true }; // offline mode or no instance to deactivate

  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/deactivate', {
      method: 'POST',
      headers: LS_HEADERS(),
      body: JSON.stringify({
        license_key: key.trim(),
        instance_id: instanceId,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    // LS returns { deactivated: true } on success
    return { ok: data.deactivated === true };
  } catch {
    // Deactivation failure is non-fatal — don't block the user from removing their key locally
    return { ok: false };
  }
}

// ── LemonSqueezy: Validate (read-only, no slot consumed) ─────────────────────
/**
 * Validate a key without activating it — used to check if an already-stored key is still valid.
 * Does NOT consume an activation slot.
 */
export async function validateStoredLicense(key) {
  if (!LS_API_KEY) return parseOfflineKey(key);
  if (!key) return { valid: false, tier: null, error: 'No key' };

  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: LS_HEADERS(),
      body: JSON.stringify({ license_key: key.trim() }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!data.valid) return { valid: false, tier: null, error: data.error || 'Key is no longer valid.' };
    const tier = resolveTier(data.meta?.product_id);
    return { valid: Boolean(tier), tier: tier || null, error: tier ? null : 'Unknown product.' };
  } catch {
    // On network error, trust the locally stored tier (offline-first)
    return { valid: true, tier: null, error: null, offlineFallback: true };
  }
}

// ── Backward-compat alias (used in feature gates — sync, no API call) ─────────
/**
 * Quick offline parse — used only for feature gating on every request.
 * Does NOT call LemonSqueezy. Returns cached tier from config.
 */
export function parseLicenseKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, tier: null, error: 'No license key provided.' };
  }
  return parseOfflineKey(key);
}

// ── Config helpers ────────────────────────────────────────────────────────────

export function hasProLicense(config) {
  if (!config?.licenseKey) return false;
  if (config.licenseTier === 'pro' || config.licenseTier === 'team') return true;
  // Offline fallback
  const key = config.licenseKey.trim().toUpperCase();
  if (OFFLINE_KEY_REGEX.test(key)) return true;
  // UUID-format key from LS — trust the stored tier
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return true;
  return false;
}

export function hasTeamLicense(config) {
  if (!config?.licenseKey) return false;
  if (config.licenseTier === 'team') return true;
  const key = config.licenseKey.trim().toUpperCase();
  return key.startsWith('RT-TEAM-') && OFFLINE_KEY_REGEX.test(key);
}

export function getLicenseTier(config) {
  if (!config?.licenseKey) return 'free';
  // Trust the stored tier (set during activation)
  if (config.licenseTier === 'team') return 'team';
  if (config.licenseTier === 'pro')  return 'pro';
  // Offline format fallback
  const key = config.licenseKey.trim().toUpperCase();
  if (OFFLINE_KEY_REGEX.test(key)) return key.startsWith('RT-TEAM-') ? 'team' : 'pro';
  // UUID key with no stored tier → assume pro
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return 'pro';
  return 'free';
}

export function checkFeature(feature, config) {
  const tier = getLicenseTier(config);
  if (TEAM_FEATURES.has(feature)) return { allowed: tier === 'team', upgrade: TEAM_URL };
  if (PRO_FEATURES.has(feature))  return { allowed: tier === 'pro' || tier === 'team', upgrade: UPGRADE_URL };
  return { allowed: true, upgrade: null };
}
