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
