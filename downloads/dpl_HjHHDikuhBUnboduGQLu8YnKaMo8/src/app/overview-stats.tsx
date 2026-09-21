"use client";

import { useState } from 'react';

type StatsData = {
  boys: { id: string; mentorId: string; status: string }[];
  mentors: { id: string; name: string }[];
  programs: { id: string; date: string }[];
  attendance: { programId: string; boyId: string; status: string }[];
  refreshedAt: string;
};

export default function OverviewStats({ data, loading = false, error = '' }: { data: StatsData; loading?: boolean; error?: string }) {
  const [period, setPeriod] = useState('all');
  const [mentor, setMentor] = useState('all');
  const today = (data.refreshedAt || new Date().toISOString()).slice(0, 10);
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  if (period !== 'all') start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  const from = period === 'all' ? '' : start.toISOString().slice(0, 10);
  const boys = data.boys.filter(boy => mentor === 'all' || boy.mentorId === mentor);
  const boyIds = new Set(boys.map(boy => boy.id));
  const sessions = new Map(data.programs.filter(program => /^\d{4}-\d{2}-\d{2}/.test(program.date) && program.date.slice(0, 10) >= from && program.date.slice(0, 10) <= today).map(program => [program.id, program]));
  // One attendance result per participant/session, even if duplicate rows exist.
  const records = [...new Map(data.attendance.filter(row => boyIds.has(row.boyId) && sessions.has(row.programId) && ['Present', 'Late', 'Absent'].includes(row.status)).map(row => [JSON.stringify([row.programId, row.boyId]), row])).values()];
  const attended = records.filter(row => row.status === 'Present' || row.status === 'Late');
  const reached = new Set(attended.map(row => row.boyId)).size;
  const rate = records.length ? Math.round(attended.length / records.length * 100) : null;
  const months = new Map<string, number>();
  const earliestMonth = period === 'all'
    ? [...sessions.values()].map(program => program.date.slice(0, 7)).sort()[0] || today.slice(0, 7)
    : from.slice(0, 7);
  const chartStart = new Date(end); chartStart.setUTCDate(1); chartStart.setUTCMonth(chartStart.getUTCMonth() - 11);
  const firstMonth = earliestMonth < chartStart.toISOString().slice(0, 7) ? chartStart.toISOString().slice(0, 7) : earliestMonth;
  const cursor = new Date(`${firstMonth}-01T00:00:00Z`);
  while (cursor <= end) {
    months.set(cursor.toISOString().slice(0, 7), 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const row of attended) {
    const month = sessions.get(row.programId)!.date.slice(0, 7);
    if (months.has(month)) months.set(month, (months.get(month) || 0) + 1);
  }
  const peak = Math.max(1, ...months.values());
  const statuses = ['Active', 'Passive', 'Dropped', 'Unspecified'].map(label => ({ label, value: boys.filter(boy => label === 'Unspecified' ? !['Active','Passive','Dropped'].includes(boy.status) : boy.status === label).length }));
  const hasData = !!data.refreshedAt;
  const colors = ['#277967', '#e9ad52', '#c77572', '#b3b9c4'];
  let offset = 0;
  const segments = statuses.map((item, i) => { const start = offset; offset += item.value / Math.max(1, boys.length) * 100; return `${colors[i]} ${start}% ${offset}%`; });
  const ring = boys.length ? `conic-gradient(${segments.join(',')})` : 'conic-gradient(#e9edf2 0% 100%)';
  return <section className="overview-analytics analytics-studio" aria-label="Overview statistics" aria-busy={loading}>
    <div className="analytics-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h2>Your mentoring impact<span>.</span></h2><p>See participation, spot gaps, and plan your next connection.</p></div><div className={`analytics-live ${error ? 'is-offline' : ''}`}><i />{loading ? 'Connecting to your records' : error ? (hasData ? 'Showing last loaded records' : 'Waiting for spreadsheet data') : hasData ? 'Synced with your spreadsheet' : 'No records loaded'}</div></div>
    <div className="analytics-toolbar"><div className="analytics-periods" aria-label="Attendance period">{[['30','30 days'],['90','90 days'],['all','All time']].map(([value,label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div><label className="analytics-mentor">Mentor group<select value={mentor} onChange={event => setMentor(event.target.value)}><option value="all">All mentors</option>{data.mentors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <div className="analytics-metrics">
      <article className="insight-featured"><span><b className="insight-icon" aria-hidden="true">↗</b>Attendance rate</span><strong>{!hasData || rate === null ? '—' : rate}<em>{hasData && rate !== null ? '%' : ''}</em></strong><small>{hasData ? `Present + late / ${records.length} marked entries` : 'Available once your records load'}</small></article>
      <article><span><b className="insight-icon" aria-hidden="true">◎</b>Unique boys reached</span><strong>{hasData ? reached : '—'}<em>{hasData ? ` / ${boys.length}` : ''}</em></strong><small>Attended at least once in this period</small></article>
      <article><span><b className="insight-icon" aria-hidden="true">◇</b>Yet to participate</span><strong>{hasData ? boys.length - reached : '—'}</strong><small>Current group without attendance in this period</small></article>
    </div>
    <div className="analytics-charts">
      <article className="panel trend-panel"><div className="panel-heading"><div><p className="eyebrow">PARTICIPATION OVER TIME</p><h3>Every connection counts</h3></div><span className="chart-legend"><i />Present + late</span></div>
        <div className="chart-scale" aria-hidden="true"><span>{peak}</span><span>{peak / 2}</span><span>0</span></div>
        <div className="attendance-chart" role="list" aria-label="Monthly attendance totals">{[...months].map(([month, count]) => <div className="attendance-column" role="listitem" key={month} aria-label={hasData ? `${month}: ${count} attendance entries` : `${month}: data not loaded`}><strong>{hasData ? count : '—'}</strong><div className="attendance-column-track"><span title={`${month}: ${count} entries`} style={{ height: `${hasData ? count / peak * 100 : 0}%` }} /></div><time dateTime={month}>{new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })}</time></div>)}</div>
        {!records.length && <p className="chart-empty-label">{!hasData ? 'The chart will fill when spreadsheet data arrives.' : 'No marked attendance in this selection. Try another mentor or period.'}</p>}
        <p className="analytics-note">Monthly totals, up to the latest 12 months. Summary cards cover the selected period. Future and undated sessions are excluded.</p>
      </article>
      <article className="panel status-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR COMMUNITY</p><h3>A pulse on your group</h3></div></div>
        <div className="status-donut" role="img" aria-label={hasData ? statuses.map(item => `${item.label}: ${item.value}`).join(', ') : 'Status breakdown waiting for data'} style={{background:ring}}><div><strong>{hasData ? boys.length : '—'}</strong><span>boys in this group</span></div></div>
        <div className="donut-legend">{statuses.map(({label,value},i) => <div key={label}><span><i style={{background:colors[i]}} />{label}</span><strong>{hasData ? value : '—'}<small>{hasData && boys.length ? ` ${Math.round(value / boys.length * 100)}%` : ''}</small></strong></div>)}</div>
        <p className="analytics-note">Current status for this mentor group, independent of the attendance period.</p>
      </article>
    </div>
  </section>;
}