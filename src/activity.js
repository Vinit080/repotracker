/**
 * activity.js — Local activity log for usage analytics.
 *
 * Records developer activity events to data/activity.json (max 500 entries, FIFO).
 * This is the data foundation for the Team Mode dashboard and personal productivity insights.
 * All data stays local — nothing is transmitted externally.
 */

import { promises as fs } from 'node:fs';
import { ACTIVITY_FILE } from './constants.js';

const MAX_ENTRIES = 500;

/**
 * Log a developer activity event.
 * @param {string} event  — e.g. 'ai_sync', 'repo_scan', 'terminal_open'
 * @param {Object} [meta] — optional metadata (repoName, query length, etc.)
 */
export async function logActivity(event, meta = {}) {
  try {
    let log = [];
    try {
      const raw = await fs.readFile(ACTIVITY_FILE, 'utf8');
      log = JSON.parse(raw);
      if (!Array.isArray(log)) log = [];
    } catch {
      // File missing or corrupt — start fresh
    }

    log.push({ event, ts: Date.now(), ...meta });

    // FIFO eviction — keep most recent MAX_ENTRIES
    if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);

    const tmp = ACTIVITY_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(log, null, 2));
    await fs.rename(tmp, ACTIVITY_FILE);
  } catch (err) {
    // Activity logging is non-critical — never let it crash a route
    console.warn('⚠️  Activity log write failed:', err.message);
  }
}

/**
 * Return the last `n` activity entries.
 * @param {number} [n=50]
 * @returns {Promise<Array>}
 */
export async function getRecentActivity(n = 50) {
  try {
    const raw = await fs.readFile(ACTIVITY_FILE, 'utf8');
    const log = JSON.parse(raw);
    if (!Array.isArray(log)) return [];
    return log.slice(-n).reverse(); // most recent first
  } catch {
    return [];
  }
}

/**
 * Return aggregated weekly stats from the activity log.
 * Counts events in the last 7 days grouped by event type.
 * @returns {Promise<Object>} e.g. { ai_sync: 3, repo_scan: 12, terminal_open: 7, ... }
 */
export async function getWeeklyStats() {
  try {
    const raw = await fs.readFile(ACTIVITY_FILE, 'utf8');
    const log = JSON.parse(raw);
    if (!Array.isArray(log)) return {};

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const counts = {};
    for (const entry of log) {
      if (entry.ts >= weekAgo) {
        counts[entry.event] = (counts[entry.event] || 0) + 1;
      }
    }
    return counts;
  } catch {
    return {};
  }
}
