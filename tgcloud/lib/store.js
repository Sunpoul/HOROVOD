import { db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';

export async function getSetting(key) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get();
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  const exists = await getSetting(key);
  if (exists === null) await db.insert(settings).values({ key, value: String(value) }).run();
  else await db.update(settings).set({ value: String(value) }).where(eq(settings.key, key)).run();
}
