"use client";

import { useMemo, useRef, useState } from 'react';
import { calculateRoomCoverage, FLOORS, IN_ROOM_GROUPS, OUT_ROOM_GROUPS, STATUS_LABELS, type MapBoy } from './hostel-map';

export default function HostelMapView({ boys, openProfile, ready }: { boys: MapBoy[]; openProfile: (id: string) => void; ready: boolean }) {
  const coverage = useMemo(() => calculateRoomCoverage(boys), [boys]);
  const [floor, setFloor] = useState('B0');
  const [roomKey, setRoomKey] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const room = roomKey ? coverage.byKey.get(roomKey) : null;
  const summary = coverage.summary;
  const current = coverage.floors.find(item => item.floor === floor)!;
  const viewBoy = (id: string) => { dialog.current?.close(); openProfile(id); };
  return <div className="hostel-map-view">
    <header className="map-heading"><div><p className="eyebrow">Room-to-room registration</p><h2>Hostel Coverage Map</h2><p>10 floors · 61 rooms per floor · 2 boys per room</p></div><div className="map-coverage-score"><strong>{ready ? `${summary.percent.toFixed(1)}%` : '—'}</strong><span>of 1,220 places covered</span></div></header>
    <p className="map-help">Calculated from Active and Passive boys. Dropped boys are excluded. Assign a floor to include an existing room registration.</p>
    {!ready ? <p role="status">Coverage will appear after the Boys database loads successfully.</p> : <>
      <div className="map-stats">{[['Total rooms',summary.total],['Fully covered',summary.full],['Partially covered',summary.partial],['Not covered',summary.empty],['Registered boys mapped',summary.mapped],['Over-capacity rooms',summary.issues]].map(([label,value]) => <article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div>
      {coverage.unmapped.length > 0 && <details className="map-unmapped"><summary>{coverage.unmapped.length} boys need floor / room information or a data correction</summary><ul>{coverage.unmapped.map(({boy,reason},index) => <li key={`${boy.id}-${index}`}><button className="text-button" onClick={() => openProfile(boy.id)}>{boy.name || 'Unnamed record'}</button><span>{reason}{boy.hostel ? ` · Room ${boy.hostel}` : ''}</span></li>)}</ul></details>}
      <div className="map-floor-tabs" role="group" aria-label="Choose floor">{FLOORS.map(item => <button key={item} aria-pressed={floor === item} onClick={() => setFloor(item)}>{item}<small>{coverage.floors.find(f => f.floor === item)!.percent.toFixed(0)}%</small></button>)}</div>
      <div className="map-floor-heading"><h3>{floor} <span>Floor coverage</span></h3><p>{current.full} full · {current.partial} partial · {current.empty} not covered{current.issues > 0 ? ` · ${current.issues} data issues` : ''}</p></div>
      <div className="map-legend">{Object.entries(STATUS_LABELS).map(([status,label]) => <span key={status}><i className={`room-${status}`} />{label}{status === 'partial' ? ' (1/2)' : status === 'full' ? ' (2/2)' : status === 'data-issue' ? ' (>2)' : ''}</span>)}</div>
      <p className="map-help">Select a room to see its registrations. Scroll sideways to explore both wings.</p>
      <div className="map-scroll" tabIndex={0} role="region" aria-label={`${floor} room layout, scroll horizontally`}><div className="map-layout">
        {([{side:'OUT',groups:OUT_ROOM_GROUPS},{side:'IN',groups:IN_ROOM_GROUPS}]).map(({side,groups},index) => <div key={side}>
          {index === 1 && <div className="map-corridor"><span>HOSTEL CORRIDOR</span></div>}
          <div className="map-side"><b>{side}</b><div className="map-room-groups">{groups.map((group,i) => <div className="map-room-group" key={i}>{group.map(number => {
            const item = coverage.byKey.get(`${floor}-${number}`)!;
            return <button key={number} className={`map-room room-${item.status}`} aria-label={`${floor} room ${number}: ${STATUS_LABELS[item.status]}, ${item.boys.length} of 2 registered`} onClick={() => {setRoomKey(item.key);dialog.current?.showModal();}}><strong>{number}</strong><span>{item.boys.length}/2</span>{item.status === 'data-issue' && <small>Issue</small>}</button>;
          })}</div>)}</div></div>
        </div>)}
      </div></div>
      <details className="map-floor-overview"><summary>Compare all floors</summary><div className="table-wrap"><table><thead><tr><th>Floor</th><th>Full</th><th>Partial</th><th>Not covered</th><th>Data issues</th><th>Coverage</th></tr></thead><tbody>{coverage.floors.map(item => <tr key={item.floor}><td><button className="text-button" onClick={() => setFloor(item.floor)}>{item.floor}</button></td><td>{item.full}</td><td>{item.partial}</td><td>{item.empty}</td><td>{item.issues}</td><td><progress max="100" value={item.percent} aria-label={`${item.floor} coverage`} /> {item.percent.toFixed(1)}%</td></tr>)}</tbody></table></div></details>
    </>}
    <dialog ref={dialog} className="map-room-dialog" onClick={event => {if(event.target === dialog.current) dialog.current.close();}}>
      {room && <><div className="map-dialog-heading"><div><p className="eyebrow">Floor {room.floor}</p><h3>{room.floor} · Room {room.number}</h3></div><button className="modal-close" aria-label="Close room details" onClick={() => dialog.current?.close()}>×</button></div><p><strong>{STATUS_LABELS[room.status]}</strong> · Registered: {room.boys.length} / 2</p>{room.status === 'data-issue' && <p className="map-room-warning">This room exceeds capacity. Open a profile to check its floor and room.</p>}<h4>Registered boys</h4>{room.boys.length ? <ul>{room.boys.map(boy => <li key={boy.id}><span>{boy.name}</span><button className="text-button" onClick={() => viewBoy(boy.id)}>View profile →</button></li>)}</ul> : <p>No registered boys in this room.</p>}</>}
    </dialog>
  </div>;
}
