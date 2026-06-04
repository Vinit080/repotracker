export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function safeUrl(url) {
  if (!url) return '';
  const str = String(url).trim();
  if (/^(?:javascript|data|vbscript):/i.test(str)) {
    return 'about:blank';
  }
  return escapeAttribute(str);
}

export function renderChip(label, tone = '') {
  const className = ['chip', tone].filter(Boolean).join(' ');
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

export function emptySmall(text) {
  const item = document.createElement('div');
  item.className = 'muted';
  item.textContent = text;
  return item;
}
