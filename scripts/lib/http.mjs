export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url, { headers = {}, timeoutMs = 15000, retries = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
