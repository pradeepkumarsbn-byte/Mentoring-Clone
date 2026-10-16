export function monthDates(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, number] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({length: days}, (_, index) => `${month}-${String(index + 1).padStart(2,"0")}`);
}
export function rcSummary(records: {date: string; status: string}[], month: string, today: string) {
  const days = monthDates(month).filter(date => date <= today);
  const byDate = new Map(records.map(r => [r.date,r.status]));
  const count = (status: string) => days.filter(date => byDate.get(date) === status).length;
  const present=count("Present"), mmc=count("MMC"), absent=count("Absent"), outstation=count("Outstation");
  const marked=present+mmc+absent;
  const rate=marked ? Math.round((present+mmc)/marked*100) : null;
  const participation = marked ? (present+mmc)/marked : 0;
  const label = !marked ? "No participation records" : absent && participation < 0.8 ? "Needs attention" : marked >= 7 && participation >= 0.8 ? "Regular" : "Building a record";
  return {present,mmc,absent,outstation,rate,label,unmarked:days.length-marked-outstation};
}
