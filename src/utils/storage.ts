export async function setData(key: string, value: any): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function getData(key: string): Promise<any | null> {
  const value: any | null = await browser.storage.local.get(key);
  return value[key] ?? null;
}

export async function removeData(key: string): Promise<void> {
  await browser.storage.local.remove(key);
}
