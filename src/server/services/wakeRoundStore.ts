import { createHmac } from "node:crypto";
import { createR2ObjectRequester } from "../../../api/wake-up-image.js";

export function createWakeRoundStore(databaseId: string) {
  const request = createR2ObjectRequester();
  const secret = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
  const key = (id: string) => "awakening-rounds/v1/" +
    createHmac("sha256", secret).update(JSON.stringify([databaseId, id])).digest("hex");

  async function getClaim(id: string) {
    const response = await request("HEAD", key(id));
    if (response.status === 404) return null;
    if (!response.ok) throw Error(`Wake round status failed (${response.status})`);
    const modifiedAt = new Date(response.headers.get("last-modified") || "");
    return { modifiedAt: Number.isFinite(modifiedAt.getTime()) ? modifiedAt : null };
  }

  const ringingKey = (accountCityKey: string) => key("ringing:" + accountCityKey);
  return {
    async publishRinging(accountCityKey: string, scheduledAt: string) {
      const response = await request("PUT", ringingKey(accountCityKey), Buffer.from(scheduledAt), "text/plain");
      if (!response.ok) throw Error(`Ringing round update failed (${response.status})`);
    },
    async getRinging(accountCityKey: string) {
      const response = await request("GET", ringingKey(accountCityKey));
      if (response.status === 404) return null;
      if (!response.ok) throw Error(`Ringing round lookup failed (${response.status})`);
      const scheduled = new Date(await response.text());
      return Number.isFinite(scheduled.getTime()) ? scheduled : null;
    },
    async claim(id: string) {
      const response = await request("PUT", key(id), Buffer.from("{}"), "application/json", { "if-none-match": "*" });
      if (response.status === 412 || response.status === 409) return false;
      if (response.status === 429 && await getClaim(id)) return false;
      if (!response.ok) throw Error(`Wake round claim failed (${response.status})`);
      return true;
    },
    getClaim,
    async release(id: string) {
      const response = await request("DELETE", key(id));
      if (!response.ok) throw Error(`Wake round release failed (${response.status})`);
    },
  };
}
