import fs from "fs";
import { parse } from "csv-parse/sync";
import AdSpend from "../../models/AdSpend";

type Row = Record<string, string>;

function get(r: Row, keys: string[], def: string = "") {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== "") return r[k];
  }
  return def;
}

export async function importCSV(path: string, source: "google"|"meta"|"tiktok") {
  const text = fs.readFileSync(path, "utf8");
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Row[];

  for (const r of rows) {
    const dateStr = get(r, ["date","Date","day","Day"]);
    const date = new Date(dateStr);
    const campaignId = String(get(r, ["campaign_id","Campaign ID","CampaignID","campaign","Campaign"], "unknown"));

    const impressions = Number(get(r, ["impressions","Impressions"], "0"));
    const clicks      = Number(get(r, ["clicks","Clicks"], "0"));
    const conversions = Number(get(r, ["conversions","Conversions"], "0"));
    const cost        = Number(get(r, ["cost","Cost","Spend","spend"], "0"));

    await AdSpend.updateOne(
      { date, source, campaignId },
      { $set: { impressions, clicks, conversions, cost } },
      { upsert: true }
    );
  }
}
