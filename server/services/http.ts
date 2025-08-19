import pRetry from "p-retry";

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await pRetry(async () => {
      const res = await fetch(url, { ...rest, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0,200)}`);
      }
      return res.json() as Promise<T>;
    }, { 
      retries: 3, 
      factor: 2, 
      minTimeout: 300, 
      maxTimeout: 2000, 
      randomize: true,
      onFailedAttempt: (error) => {
        console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<string> {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await pRetry(async () => {
      const res = await fetch(url, { ...rest, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0,200)}`);
      }
      return res.text();
    }, { 
      retries: 3, 
      factor: 2, 
      minTimeout: 300, 
      maxTimeout: 2000, 
      randomize: true 
    });
  } finally {
    clearTimeout(id);
  }
}