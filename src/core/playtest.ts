/** 本地试玩时显示开发入口（localhost / 127.0.0.1） */
export function showDevMenuEntries(): boolean {
  const host = globalThis.location?.hostname ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
