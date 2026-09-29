import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Badge, Card, Empty, ErrorBox, Loader, PageHeader, useFetch } from '../components/ui';
import { fullName } from '../lib/format';

const busIcon = color => L.divIcon({ className: '', html: `<div class="bus-marker" style="background:${color}"></div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
const schoolIcon = L.divIcon({ className: '', html: '<div class="school-marker">A</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(points, { padding: [30, 30] }); }, [map, points]);
  return null;
}

/**
 * Suivi temps réel. Positions GPS reçues via Socket.IO (bus:position).
 * Fond de carte OpenStreetMap — en production, utiliser un fournisseur de tuiles
 * (MapTiler, Mapbox…) conformément à la politique d'usage d'OSM.
 */
export default function Transport() {
  const { socket } = useAuth();
  const { t } = useI18n();
  const { data, loading, error } = useFetch('/transport/buses');
  const [live, setLive] = useState({});
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    if (!socket || !data) return undefined;
    data.data.forEach(b => socket.emit('bus:follow', b.id));
    const onPos = p => setLive(l => ({ ...l, [p.busId]: p }));
    socket.on('bus:position', onPos);
    return () => { socket.off('bus:position', onPos); data.data.forEach(b => socket.emit('bus:unfollow', b.id)); };
  }, [socket, data]);

  const buses = data ? data.data : [];
  const points = useMemo(() => buses.flatMap(b => b.stops.map(s => [Number(s.lat), Number(s.lng)])), [buses]);
  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  if (!buses.length) return <><PageHeader title={t('bus.title')} /><Empty>{t('bus.none')}</Empty></>;
  const school = buses[0].stops[buses[0].stops.length - 1];
  const shown = focus ? buses.filter(b => b.id === focus) : buses;

  return (
    <>
      <PageHeader title={t('bus.title')} sub={t('bus.sub')} />
      <div className="grid g-main">
        <Card title={t('bus.live')} flush>
          <div style={{ padding: '0 14px 14px' }}>
            <MapContainer center={[Number(school.lat), Number(school.lng)]} zoom={13} style={{ height: 460 }} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitBounds points={points} />
              <Marker position={[Number(school.lat), Number(school.lng)]} icon={schoolIcon}><Tooltip>{school.name}</Tooltip></Marker>
              {shown.map(b => {
                const p = live[b.id] || b.position;
                return (
                  <Fragment key={b.id}>
                    <Polyline positions={b.stops.map(s => [Number(s.lat), Number(s.lng)])} pathOptions={{ color: b.color, weight: 5, opacity: 0.75 }} />
                    {b.stops.slice(0, -1).map(s => <CircleMarker key={s.id} center={[Number(s.lat), Number(s.lng)]} radius={6} pathOptions={{ color: b.color, fillColor: '#fff', fillOpacity: 1, weight: 3 }}><Tooltip>{s.name} · {s.scheduledTime.slice(0, 5)}</Tooltip></CircleMarker>)}
                    {p && <Marker position={[Number(p.lat), Number(p.lng)]} icon={busIcon(b.color)}><Tooltip permanent direction="top" offset={[0, -12]}>{b.lineName.split(' — ')[0]}</Tooltip></Marker>}
                  </Fragment>
                );
              })}
            </MapContainer>
          </div>
        </Card>
        <Card title={t('bus.lines')} flush>
          <div className="list">{buses.map(b => {
            const eta = (live[b.id] && live[b.id].eta) || b.eta;
            return (
              <div className="li click" key={b.id} onClick={() => setFocus(focus === b.id ? null : b.id)} style={focus === b.id ? { background: 'var(--beige-50)' } : undefined}>
                <i style={{ width: 4, height: 36, borderRadius: 2, background: b.color }} />
                <div className="grow"><div className="t">{b.lineName}</div><div className="s">{t('bus.students', { n: b.students })} · {b.driver ? `${t('bus.driver')} : ${fullName(b.driver)}` : '—'}</div></div>
                <div style={{ textAlign: 'end' }}><div style={{ fontWeight: 600, fontSize: 13 }}>{eta ? `${eta.minutesToSchool} min` : '—'}</div>{b.delayMinutes ? <Badge kind="warning">{t('bus.delay', { n: b.delayMinutes })}</Badge> : <Badge kind="success">{t('bus.onTime')}</Badge>}</div>
              </div>
            );
          })}</div>
        </Card>
      </div>
    </>
  );
}
