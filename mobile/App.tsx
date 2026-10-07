import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { configureSession, onSessionExpired, request } from './src/api';
import { Button, Card, colors, Field, Muted, Title } from './src/ui';

type Session = { user: { id: number; firstName: string; lastName: string; email: string; role: string }; tenant: { name: string }; permissions: string[]; student?: any; children?: any[] };
const name = (p: any) => p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : '';
const date = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const rows = (d: any): any[] => d?.data || [];
const can = (s: Session, p: string) => s.permissions.some(v => v === '*' || v === p || v === `${p.split(':')[0]}:*`);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState('alfarabi');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [twoFactor, setTwoFactor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Accueil');
  useEffect(() => { onSessionExpired(() => { setSession(null); setTwoFactor(false); setCode(''); }); return () => onSessionExpired(() => {}); }, []);
  const login = async () => {
    setBusy(true); setError(''); configureSession(tenant, null);
    try {
      const d = await request('/auth/login', 'POST', { email: email.trim(), password, ...(twoFactor ? { code } : {}) });
      if (d.twoFactorRequired) { setTwoFactor(true); return; }
      configureSession(tenant, d.accessToken); setSession(await request('/auth/me')); setPassword(''); setCode(''); setTwoFactor(false); setTab('Accueil');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await request('/auth/logout', 'POST'); configureSession(tenant, null); setSession(null); setError(''); }
    catch (e) { Alert.alert('Déconnexion impossible', (e as Error).message); } finally { setBusy(false); }
  };
  const tabs = session ? ['Accueil', ...(can(session, 'homework:read') ? ['Devoirs'] : []), ...(can(session, 'timetable:read') ? ['Planning'] : []), ...(can(session, 'messages:read') ? ['Messages'] : []), 'Alertes', 'Compte'] : [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {!session ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1, justifyContent: 'center' }}>
        <Text style={{ color: colors.navy, fontSize: 38, fontWeight: '800' }}>Athénée<Text style={{ color: colors.gold }}>.</Text></Text><Muted>Votre école, à portée de main.</Muted>
        <Card><Title>Bienvenue</Title><Muted>Connectez-vous à votre établissement.</Muted>
          <View style={{ flexDirection: 'row', gap: 8 }}>{['alfarabi', 'lumiere'].map(slug => <Pressable key={slug} accessibilityRole="button" accessibilityState={{ selected: tenant === slug }} disabled={busy} onPress={() => { setTenant(slug); setTwoFactor(false); setCode(''); }} style={{ padding: 12, borderRadius: 10, backgroundColor: tenant === slug ? '#E8DFCF' : colors.paper }}><Text>{slug === 'alfarabi' ? 'Al Farabi' : 'Lumière'}</Text></Pressable>)}</View>
          <Field label="Adresse email" value={email} onChangeText={v => { setEmail(v); setTwoFactor(false); }} autoCapitalize="none" keyboardType="email-address" autoComplete="username" editable={!busy} />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
          {twoFactor && <Field label="Code de vérification" value={code} onChangeText={setCode} maxLength={6} keyboardType="number-pad" />}
          {!!error && <Text accessibilityRole="alert" style={{ color: '#B13939' }}>{error}</Text>}
          <Button label={busy ? 'Connexion…' : 'Se connecter'} disabled={busy || !email.trim() || !password || (twoFactor && code.length !== 6)} onPress={login} />
        </Card>
      </ScrollView> : <>
        <View style={{ paddingHorizontal: 22, paddingVertical: 16, gap: 4 }}><Text style={{ color: colors.gold, fontWeight: '800', letterSpacing: 3 }}>ATHÉNÉE</Text><Title>{tab}</Title><Muted>{session.tenant.name}</Muted></View>
        {tab === 'Compte' ? <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><Card><Title>{name(session.user)}</Title><Muted>{session.user.email}</Muted><Muted>Rôle : {session.user.role}</Muted></Card><Button label={busy ? 'Déconnexion…' : 'Se déconnecter'} disabled={busy} onPress={logout} /></ScrollView> : <Content key={tab} tab={tab} session={session} />}
        <View style={{ backgroundColor: 'white', borderTopWidth: 1, borderColor: colors.line }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8 }}>{tabs.map(t => <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={{ padding: 14, borderRadius: 12, backgroundColor: tab === t ? colors.paper : 'white' }}><Text style={{ color: colors.navy, fontWeight: tab === t ? '800' : '400' }}>{t}</Text></Pressable>)}</ScrollView></View>
      </>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Content({ tab, session }: { tab: string; session: Session }) {
  const [data, setData] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState<number | null>(session.student?.classId || session.children?.[0]?.classId || null);
  const [conversation, setConversation] = useState<any>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const reload = () => setRevision(v => v + 1);
  const dashboard = tab === 'Accueil' && can(session, 'dashboard:read');
  const alerts = tab === 'Alertes' || (tab === 'Accueil' && !dashboard);
  const needsClass = tab === 'Planning' && session.user.role !== 'teacher';
  const path = dashboard ? '/dashboard' : tab === 'Devoirs' ? '/homework' : tab === 'Planning' ? `/timetable${classId ? `?classId=${classId}` : ''}` : tab === 'Messages' ? conversation ? `/conversations/${conversation.id}/messages` : '/conversations' : '/notifications';
  useEffect(() => {
    if (!needsClass) return;
    let active = true;
    request('/classes').then(d => { if (active) { setClasses(rows(d)); setClassId(v => v || rows(d)[0]?.id || null); } }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [needsClass, revision]);
  useEffect(() => {
    let active = true; setData(null); setError('');
    if (needsClass && !classId) { setLoading(false); return; }
    setLoading(true);
    request(path).then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, needsClass, classId, revision]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (conversation) { setConversation(null); return true; } return false; }); return () => sub.remove(); }, [conversation]);
  const send = async () => {
    if (!text.trim() || sending) return; setSending(true);
    try { await request(`/conversations/${conversation.id}/messages`, 'POST', { body: text.trim() }); setText(''); reload(); }
    catch (e) { Alert.alert('Message non envoyé', (e as Error).message); } finally { setSending(false); }
  };
  return <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 30 }}>
    {needsClass && <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{classes.map(c => <Button key={c.id} label={`${classId === c.id ? '✓ ' : ''}${c.name}`} onPress={() => setClassId(c.id)} />)}</ScrollView>}
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: '#B13939' }}>{error}</Text><Button label="Réessayer" onPress={reload} /></Card>}
    {loading && !data && <ActivityIndicator size="large" color={colors.navy} />}
    {dashboard && data && <>
      <Card><Title>Bonjour, {session.user.firstName}</Title><Muted>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Muted></Card>
      {data.children?.map((c: any) => <Card key={c.student.id}><Title>{name(c.student)}</Title><Muted>{c.student.class?.name} · {c.absentToday ? 'Absent aujourd’hui' : 'Présent aujourd’hui'}</Muted><Text style={{ fontSize: 30, color: colors.navy, fontWeight: '700' }}>{c.average == null ? '—' : Number(c.average).toFixed(2)} /20</Text><Muted>Rang : {c.rank || '—'}</Muted>{c.homework?.map((h: any) => <Text key={h.id}>{h.title} · {date(h.dueAt)}</Text>)}<Muted>{c.pendingInvoices?.length || 0} facture(s) en attente</Muted></Card>)}
      {data.kpis && <Card><Title>Vue d’ensemble</Title>{[['students', 'Élèves'], ['teachers', 'Enseignants'], ['classes', 'Classes'], ['pendingPayments', 'Paiements en attente']].map(([k, label]) => <Text key={k}>{label} : {data.kpis[k] ?? '—'}</Text>)}</Card>}
      {data.today && <Card><Title>Cours aujourd’hui</Title>{data.today.length ? data.today.map((c: any) => <Text key={c.id}>{c.startTime?.slice(0, 5)} · {c.subject?.name} · {c.class?.name}</Text>) : <Muted>Aucun cours aujourd’hui.</Muted>}</Card>}
      {data.announcements?.map((a: any) => <Card key={a.id}><Title>{a.title}</Title><Muted>{a.body}</Muted></Card>)}
    </>}
    {tab === 'Devoirs' && rows(data).map(h => <Card key={h.id}><Muted>{h.subject?.name} · {h.class?.name}</Muted><Title>{h.title}</Title><Text>À rendre le {date(h.dueAt)}</Text><Muted>{h.instructions}</Muted>{h.submissions?.map((s: any) => <Muted key={s.id}>{({ todo: 'À faire', submitted: 'Rendu', late: 'En retard', graded: 'Corrigé' } as Record<string, string>)[s.status] || s.status}{s.score != null ? ` · ${s.score}/20` : ''}</Muted>)}</Card>)}
    {tab === 'Planning' && rows(data).map(c => <Card key={c.id}><Muted>{['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][c.weekday]} · {c.startTime?.slice(0, 5)} — {c.endTime?.slice(0, 5)}</Muted><Title>{c.subject?.name}</Title><Muted>{c.class?.name} · Salle {c.room?.name || '—'}</Muted>{c.exceptions?.map((e: any) => <Text key={e.id}>{date(e.onDate)} · {e.kind} {e.note}</Text>)}</Card>)}
    {tab === 'Messages' && !conversation && rows(data).map(c => <Pressable key={c.id} accessibilityRole="button" onPress={() => setConversation(c)}><Card><Title>{c.title || name(c.members?.find((m: any) => m.user.id !== session.user.id)?.user) || 'Conversation'}</Title><Muted>{c.lastMessage?.body || 'Ouvrir la conversation'}</Muted></Card></Pressable>)}
    {tab === 'Messages' && conversation && <><Button label="← Conversations" onPress={() => setConversation(null)} />{rows(data).map(m => <View key={m.id} style={{ alignSelf: m.senderId === session.user.id ? 'flex-end' : 'flex-start', maxWidth: '90%', backgroundColor: m.senderId === session.user.id ? '#E8DFCF' : 'white', padding: 16, borderRadius: 16 }}><Text>{m.body}</Text><Muted>{date(m.createdAt)}</Muted></View>)}<Field label="Votre message" value={text} onChangeText={setText} multiline maxLength={5000} /><Button label={sending ? 'Envoi…' : 'Envoyer'} onPress={send} disabled={sending || !text.trim()} /></>}
    {alerts && data && <>{!!data.unread && <Button label={`Marquer ${data.unread} alerte(s) comme lues`} onPress={async () => { try { await request('/notifications/read', 'POST'); reload(); } catch (e) { Alert.alert('Erreur', (e as Error).message); } }} />}{rows(data).map(n => <Card key={n.id}><Muted>{n.readAt ? 'Lu' : 'Nouveau'} · {date(n.createdAt)}</Muted><Title>{n.title}</Title><Muted>{n.body}</Muted></Card>)}</>}
    {!loading && !error && data && !dashboard && rows(data).length === 0 && <Card><Muted>Aucun élément à afficher.</Muted></Card>}
    {!loading && !error && needsClass && !classId && <Card><Muted>Aucune classe accessible.</Muted></Card>}
  </ScrollView>;
}
