"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; name: string };
type Workspace = { id: string; name: string; type: "personal" | "business"; role: string };
type RecordItem = { id: string; kind: string; title: string; amount: number | null; due_date: string | null; data: Record<string, any>; created_at: string };
type DocItem = { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string };
type PageKey = "home" | "expenses" | "tasks" | "events" | "docs" | "contacts" | "notes" | "invoices" | "employees" | "reports";

const menuPersonal: { key: PageKey; label: string; icon: string; kind?: string }[] = [
  { key: "home", label: "Panoramica", icon: "⌂" },
  { key: "expenses", label: "Spese e budget", icon: "€", kind: "expense" },
  { key: "tasks", label: "Attività", icon: "✓", kind: "task" },
  { key: "events", label: "Scadenze e agenda", icon: "▦", kind: "event" },
  { key: "docs", label: "Documenti", icon: "▤" },
  { key: "contacts", label: "Contatti", icon: "♙", kind: "contact" },
  { key: "notes", label: "Note", icon: "✎", kind: "note" },
];
const menuBusiness: { key: PageKey; label: string; icon: string; kind?: string }[] = [
  { key: "home", label: "Panoramica", icon: "⌂" },
  { key: "expenses", label: "Spese e costi", icon: "€", kind: "expense" },
  { key: "invoices", label: "Fatture e incassi", icon: "▧", kind: "invoice" },
  { key: "employees", label: "Collaboratori", icon: "♙", kind: "employee" },
  { key: "events", label: "Scadenze", icon: "▦", kind: "event" },
  { key: "tasks", label: "Attività", icon: "✓", kind: "task" },
  { key: "docs", label: "Documenti", icon: "▤" },
  { key: "contacts", label: "Clienti e fornitori", icon: "♧", kind: "contact" },
  { key: "reports", label: "Report", icon: "▥" },
];

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", headers: { ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(init?.headers || {}) } });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || `Errore ${response.status}`);
  return body as T;
}
const money = (n: number) => Number(n || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
const dateLabel = (s?: string | null) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("it-IT") : "—";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [page, setPage] = useState<PageKey>("home");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"record" | "document" | "invite" | "workspace" | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const workspace = workspaces.find(w => w.id === workspaceId) || null;
  const business = workspace?.type === "business";
  const menu = business ? menuBusiness : menuPersonal;
  const activeMenu = menu.find(m => m.key === page);
  const recordKind = activeMenu?.kind || (page === "home" ? "task" : undefined);

  const refreshWorkspaces = useCallback(async () => {
    const result = await api<{ workspaces: Workspace[] }>("/api/workspaces");
    setWorkspaces(result.workspaces);
    setWorkspaceId(current => result.workspaces.some(w => w.id === current) ? current : result.workspaces[0]?.id || "");
  }, []);

  const refreshRecords = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError("");
    try {
      const result = await api<{ records: RecordItem[] }>(`/api/records?workspaceId=${encodeURIComponent(workspaceId)}`);
      setRecords(result.records);
      const docs = await api<{ documents: DocItem[] }>(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`);
      setDocuments(docs.documents);
    } catch (e) { setError(e instanceof Error ? e.message : "Errore nel caricamento dei dati."); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { api<{ user: User | null }>("/api/auth/me").then(r => setUser(r.user)).catch(() => {}).finally(() => setBooting(false)); }, []);
  useEffect(() => { if (user) refreshWorkspaces().catch(e => setError(e.message)); }, [user, refreshWorkspaces]);
  useEffect(() => { if (workspaceId) refreshRecords(); }, [workspaceId, refreshRecords]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(""), 3200); return () => clearTimeout(timer); } }, [notice]);

  const shownRecords = useMemo(() => {
    let rows = records;
    if (recordKind) rows = rows.filter(r => r.kind === recordKind);
    if (page === "home") return rows;
    const q = search.toLowerCase().trim();
    return q ? rows.filter(r => `${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(q)) : rows;
  }, [records, recordKind, page, search]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await api<{ user: User }>(`/api/auth/${authMode}`, { method: "POST", body: JSON.stringify(payload) });
      setUser(result.user); setNotice(authMode === "register" ? "Account creato! Benvenuta in SILLYN." : "Accesso effettuato.");
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Operazione non riuscita."); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } finally { setUser(null); setWorkspaces([]); setWorkspaceId(""); setRecords([]); setDocuments([]); }
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workspaceId || !recordKind) return;
    const form = new FormData(event.currentTarget);
    const payload: Record<string, any> = Object.fromEntries(form.entries());
    payload.workspaceId = workspaceId; payload.kind = recordKind;
    if (payload.amount !== undefined && payload.amount !== "") payload.amount = Number(payload.amount);
    if (payload.done !== undefined) payload.done = payload.done === "on";
    try {
      await api("/api/records", { method: "POST", body: JSON.stringify(payload) });
      setModal(null); setNotice("Elemento salvato."); await refreshRecords();
    } catch (e) { setError(e instanceof Error ? e.message : "Salvataggio non riuscito."); }
  }

  async function deleteRecord(id: string) {
    if (!confirm("Eliminare questo elemento?")) return;
    try { await api(`/api/records/${id}`, { method: "DELETE" }); await refreshRecords(); setNotice("Elemento eliminato."); }
    catch (e) { setError(e instanceof Error ? e.message : "Eliminazione non riuscita."); }
  }

  async function toggleTask(item: RecordItem) {
    try { await api(`/api/records/${item.id}`, { method: "PATCH", body: JSON.stringify({ data: { done: !item.data?.done } }) }); await refreshRecords(); }
    catch (e) { setError(e instanceof Error ? e.message : "Aggiornamento non riuscito."); }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workspaceId) return;
    const form = new FormData(event.currentTarget); form.append("workspaceId", workspaceId);
    try { await api("/api/documents", { method: "POST", body: form }); setModal(null); await refreshRecords(); setNotice("Documento caricato in archivio."); }
    catch (e) { setError(e instanceof Error ? e.message : "Caricamento non riuscito."); }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries());
    try { await api("/api/workspaces", { method: "POST", body: JSON.stringify(payload) }); setModal(null); await refreshWorkspaces(); setNotice("Spazio creato."); }
    catch (e) { setError(e instanceof Error ? e.message : "Creazione non riuscita."); }
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const payload = Object.fromEntries(form.entries());
    try { const result = await api<{ invitationCode: string; expiresAt: string }>("/api/invitations", { method: "POST", body: JSON.stringify({ ...payload, action: "create", workspaceId }) });
      const invitationCode = result.invitationCode;
      await navigator.clipboard?.writeText(invitationCode).catch(() => {});
      setModal(null); setNotice(`Codice invito: ${invitationCode} (copiato se il browser lo consente)`);
    } catch (e) { setError(e instanceof Error ? e.message : "Invito non creato."); }
  }

  async function acceptInvite() {
    const code = prompt("Inserisci il codice invito ricevuto:"); if (!code) return;
    try { await api("/api/invitations", { method: "POST", body: JSON.stringify({ action: "accept", invitationCode: code.trim() }) }); await refreshWorkspaces(); setNotice("Invito accettato: spazio aggiunto."); }
    catch (e) { setError(e instanceof Error ? e.message : "Codice non valido."); }
  }

  if (booting) return <main className="loading-screen"><div className="orb"/><p>Sto aprendo SILLYN…</p></main>;
  if (!user) return <main className="auth-shell"><div className="auth-card"><div className="brand-lockup"><div className="orb small"/><div><div className="brand">SILLYN<span>✦</span></div><div className="tagline">LA TUA VITA, ORGANIZZATA.</div></div></div><div className="eyebrow">IL TUO SPAZIO PERSONALE E BUSINESS</div><h1>{authMode === "register" ? "Crea il tuo spazio" : "Bentornata"}</h1><p className="muted">Un solo posto per organizzare attività, spese, scadenze e documenti.</p><form onSubmit={submitAuth} className="auth-form">{authMode === "register" && <label>Nome e cognome<input name="name" required autoComplete="name" placeholder="Come ti chiami?" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" placeholder="nome@email.it" /></label><label>Password<input name="password" type="password" required minLength={authMode === "register" ? 12 : 1} autoComplete={authMode === "register" ? "new-password" : "current-password"} placeholder={authMode === "register" ? "Almeno 12 caratteri" : "La tua password"} /></label>{authError && <div className="error">{authError}</div>}<button className="button primary wide" disabled={authBusy}>{authBusy ? "Attendi…" : authMode === "register" ? "Crea account" : "Accedi"}</button></form><p className="auth-switch">{authMode === "register" ? "Hai già un account?" : "Non hai ancora un account?"} <button onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }}>{authMode === "register" ? "Accedi" : "Registrati"}</button></p><div className="security-note">🔒 Password protetta · Sessione privata · Dati separati per spazio</div></div></main>;

  const totalExpenses = records.filter(r => r.kind === "expense" && (r.due_date || r.created_at?.slice(0, 10))?.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const openTasks = records.filter(r => r.kind === "task" && !r.data?.done).length;
  const upcoming = records.filter(r => r.kind === "event" && r.due_date && r.due_date >= new Date().toISOString().slice(0,10)).sort((a,b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0,4);
  const pageTitle = menu.find(m => m.key === page)?.label || "Panoramica";

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand-lockup"><div className="orb small"/><div><div className="brand">SILLYN<span>✦</span></div><div className="tagline">ORGANIZZA. CONDIVIDI. CRESCI.</div></div></div>
      <div className="workspace-picker"><span className="eyebrow">SPAZIO ATTIVO</span><select value={workspaceId} onChange={e => { setWorkspaceId(e.target.value); setPage("home"); }} aria-label="Seleziona spazio">{workspaces.map(w => <option key={w.id} value={w.id}>{w.type === "business" ? "▣" : "◇"} {w.name}</option>)}</select><button className="text-button" onClick={() => setModal("workspace")}>＋ Nuovo spazio</button></div>
      <nav className="nav-list">{menu.map(item => <button key={item.key} className={page === item.key ? "nav-item active" : "nav-item"} onClick={() => { setPage(item.key); setSearch(""); }}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={acceptInvite}><span className="nav-icon">♧</span>Accetta invito</button><button className="nav-item" onClick={() => setModal("invite")}><span className="nav-icon">＋</span>Invita una persona</button><div className="profile"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div className="profile-info"><b>{user.name}</b><small>{user.email}</small></div><button className="icon-button" title="Esci" onClick={logout}>↗</button></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div><div className="eyebrow">{business ? "IL TUO SPAZIO BUSINESS" : "IL TUO SPAZIO PERSONALE"}</div><h1>{page === "home" ? `Buongiorno, ${user.name.split(" ")[0]} ✨` : pageTitle}</h1><p>{business ? "La tua attività, organizzata in un unico posto." : "Tutto quello che conta, a portata di mano."}</p></div><div className="top-actions"><button className="button secondary" onClick={() => setModal(page === "docs" ? "document" : "record")}>＋ {page === "docs" ? "Carica documento" : "Aggiungi"}</button></div></header>
      {error && <div className="alert error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
      {notice && <div className="alert success-banner">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {page === "home" ? <>
        <section className="stats-grid"><Stat label="Spese registrate questo mese" value={money(totalExpenses)} icon="€" note="Somma delle uscite inserite"/><Stat label="Attività aperte" value={String(openTasks)} icon="✓" note="Da completare"/><Stat label="Scadenze future" value={String(records.filter(r => r.kind === "event" && r.due_date && r.due_date >= new Date().toISOString().slice(0,10)).length)} icon="▦" note="In agenda"/><Stat label="Documenti archiviati" value={String(documents.length)} icon="▤" note="Salvati nello spazio"/></section>
        <section className="home-grid"><div className="panel"><div className="panel-heading"><div><h2>Prossime scadenze</h2><p>Le date da tenere sott'occhio</p></div><button className="text-button" onClick={() => setPage("events")}>Vedi tutte →</button></div>{upcoming.length ? upcoming.map(r => <div className="list-row" key={r.id}><div className="date-chip">{dateLabel(r.due_date)}</div><div className="list-main"><b>{r.title}</b><small>{r.data?.category || "Generale"}</small></div><span className="status">In programma</span></div>) : <Empty text="Non ci sono scadenze future. Aggiungine una quando ti serve."/>}</div>
          <div className="panel"><div className="panel-heading"><div><h2>Attività da completare</h2><p>Un passo alla volta</p></div><button className="text-button" onClick={() => setPage("tasks")}>Vedi tutte →</button></div>{records.filter(r => r.kind === "task" && !r.data?.done).slice(0,5).map(r => <div className="list-row" key={r.id}><button className="check-circle" onClick={() => toggleTask(r)} aria-label="Completa attività"/><div className="list-main"><b>{r.title}</b><small>{r.due_date ? `Entro ${dateLabel(r.due_date)}` : "Senza scadenza"}</small></div></div>)}{records.filter(r => r.kind === "task" && !r.data?.done).length === 0 && <Empty text="Nessuna attività in sospeso."/>}</div></section>
        <section className="panel quick-panel"><div><h2>Accesso rapido</h2><p>Aggiungi un'informazione senza cercare tra i menu.</p></div><div className="quick-actions">{(business ? [{ k:"expense", label:"Registra una spesa", icon:"€" },{k:"invoice",label:"Aggiungi fattura",icon:"▧"},{k:"employee",label:"Aggiungi collaboratore",icon:"♙"},{k:"event",label:"Nuova scadenza",icon:"▦"}] : [{k:"expense",label:"Registra una spesa",icon:"€"},{k:"task",label:"Nuova attività",icon:"✓"},{k:"event",label:"Nuova scadenza",icon:"▦"},{k:"note",label:"Scrivi una nota",icon:"✎"}]).map(a => <button key={a.k} className="quick-tile" onClick={() => { const key = a.k === "expense" ? "expenses" : a.k === "task" ? "tasks" : a.k === "event" ? "events" : a.k === "invoice" ? "invoices" : a.k === "employee" ? "employees" : "notes"; setPage(key as PageKey); setModal("record"); }}><span>{a.icon}</span>{a.label}</button>)}</div></section>
      </> : page === "docs" ? <section className="panel"><div className="panel-heading"><div><h2>Archivio documenti</h2><p>File conservati in modo privato nello spazio selezionato.</p></div><label className="button primary file-button">＋ Carica file<input type="file" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const form = new FormData(); form.append("file", file); form.append("workspaceId", workspaceId); try { await api("/api/documents", { method: "POST", body: form }); await refreshRecords(); setNotice("Documento caricato."); } catch (err) { setError(err instanceof Error ? err.message : "Caricamento non riuscito."); } e.currentTarget.value = ""; }}/></label></div>{documents.length ? <div className="table-wrap"><table><thead><tr><th>Nome file</th><th>Formato</th><th>Dimensione</th><th>Caricato</th><th></th></tr></thead><tbody>{documents.map(d => <tr key={d.id}><td>▤ {d.file_name}</td><td>{d.mime_type.split("/").pop()}</td><td>{(d.size_bytes / 1024).toFixed(0)} KB</td><td>{new Date(d.created_at).toLocaleDateString("it-IT")}</td><td><a className="table-link" href={`/api/documents/${d.id}`} download>Scarica</a> <button className="table-link danger-link" onClick={async () => { if(confirm("Eliminare il documento?")){ await api(`/api/documents/${d.id}`,{method:"DELETE"}); await refreshRecords(); } }}>Elimina</button></td></tr>)}</tbody></table></div> : <Empty text="Nessun documento caricato. Usa il pulsante Carica file per aggiungerne uno."/>}</section> : page === "reports" ? <section className="stats-grid"><Stat label="Spese totali registrate" value={money(records.filter(r=>r.kind==="expense").reduce((s,r)=>s+Number(r.amount||0),0))} icon="€" note="Dati inseriti nello spazio"/><Stat label="Fatture registrate" value={String(records.filter(r=>r.kind==="invoice").length)} icon="▧" note="Non equivale a fatturazione elettronica"/><Stat label="Collaboratori" value={String(records.filter(r=>r.kind==="employee").length)} icon="♙" note="Anagrafica interna"/><Stat label="Documenti" value={String(documents.length)} icon="▤" note="Archivio R2"/></section> : <section className="panel"><div className="panel-heading"><div><h2>{pageTitle}</h2><p>{business ? "Gestione e consultazione dello spazio business." : "Gestione e consultazione del tuo spazio personale."}</p></div><button className="button primary" onClick={() => setModal("record")}>＋ Aggiungi</button></div><input className="search-input" placeholder="Cerca in questa sezione…" value={search} onChange={e => setSearch(e.target.value)}/>{loading ? <Empty text="Caricamento…"/> : shownRecords.length ? <div className="table-wrap"><table><thead><tr><th>Nome</th><th>Categoria / dettaglio</th><th>Data</th>{page === "expenses" || page === "invoices" ? <th>Importo</th> : null}<th>Stato</th><th></th></tr></thead><tbody>{shownRecords.map(r => <tr key={r.id}><td><b>{r.title}</b></td><td>{r.data?.category || r.data?.company || r.data?.role || r.data?.description || r.data?.body || "—"}</td><td>{dateLabel(r.due_date || r.data?.date)}</td>{page === "expenses" || page === "invoices" ? <td>{money(Number(r.amount || 0))}</td> : null}<td>{r.kind === "task" ? <span className={r.data?.done ? "badge complete" : "badge pending"}>{r.data?.done ? "Completata" : "Da fare"}</span> : <span className="badge">Registrato</span>}</td><td className="row-actions">{r.kind === "task" && <button className="table-link" onClick={() => toggleTask(r)}>{r.data?.done ? "Riapri" : "Completa"}</button>}<button className="table-link danger-link" onClick={() => deleteRecord(r.id)}>Elimina</button></td></tr>)}</tbody></table></div> : <Empty text="Ancora nessun elemento. Usa Aggiungi per inserire il primo."/>}</section>}
      <footer className="main-footer">SILLYN · Dati sincronizzati nello spazio online · {workspace?.name || "Nessuno spazio"} · <button onClick={logout}>Esci</button></footer>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) setModal(null); }}><div className="modal-card"><div className="modal-title"><div><div className="eyebrow">SILLYN</div><h2>{modal === "record" ? `Nuovo elemento · ${page === "home" ? "Attività" : pageTitle}` : modal === "document" ? "Carica documento" : modal === "invite" ? "Invita una persona" : "Crea un nuovo spazio"}</h2></div><button className="icon-button" onClick={() => setModal(null)}>×</button></div>
      {modal === "record" && <RecordForm page={page === "home" ? "tasks" : page} business={business || false} onSubmit={createRecord} onCancel={() => setModal(null)}/>}
      {modal === "document" && <form className="modal-form" onSubmit={uploadDocument}><p className="muted">PDF, immagini, Word, Excel, CSV o TXT. Massimo 15 MB per file.</p><label>Seleziona file<input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx"/></label><div className="form-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Annulla</button><button className="button primary">Carica documento</button></div></form>}
      {modal === "workspace" && <form className="modal-form" onSubmit={createWorkspace}><label>Nome spazio<input name="name" required maxLength={80} placeholder="Es. Studio, Famiglia, Negozio…"/></label><label>Tipo<select name="type"><option value="personal">Personale</option><option value="business">Business</option></select></label><div className="form-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Annulla</button><button className="button primary">Crea spazio</button></div></form>}
      {modal === "invite" && <form className="modal-form" onSubmit={createInvite}><p className="muted">Crea un codice temporaneo da condividere con una persona. La persona dovrà registrarsi o accedere e poi scegliere “Accetta invito”.</p><label>Email (facoltativa)<input name="email" type="email" placeholder="persona@email.it"/></label><label>Permesso<select name="role"><option value="member">Può visualizzare e modificare</option><option value="viewer">Solo visualizzazione</option><option value="admin">Amministratore</option></select></label><div className="form-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>Annulla</button><button className="button primary">Genera codice</button></div></form>}
    </div></div>}
    {notice && <div className="toast">{notice}</div>}
  </div>;
}

function Stat({ label, value, icon, note }: { label: string; value: string; icon: string; note: string }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon">✦</div><p>{text}</p></div>; }

function RecordForm({ page, business, onSubmit, onCancel }: { page: PageKey; business: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const categoryOptions = page === "expenses" ? ["Casa", "Alimentari", "Trasporti", "Utenze", "Lavoro", "Altro"] : page === "invoices" ? ["Da incassare", "Incassata", "Scaduta"] : page === "employees" ? ["Dipendente", "Collaboratore", "Fornitore"] : ["Generale", "Personale", "Lavoro", "Pagamento", "Appuntamento", "Altro"];
  const needsAmount = page === "expenses" || page === "invoices";
  const [kindTitle, setKindTitle] = useState("");
  useEffect(() => { setKindTitle(page === "expenses" ? "Nuova spesa" : page === "tasks" ? "Nuova attività" : page === "events" ? "Nuova scadenza" : page === "invoices" ? "Nuova fattura / incasso" : page === "employees" ? "Nuovo collaboratore" : page === "contacts" ? "Nuovo contatto" : "Nuova nota"); }, [page]);
  return <form className="modal-form" onSubmit={onSubmit}><p className="muted">{kindTitle} · I dati vengono salvati nello spazio attivo.</p><label>Nome / descrizione<input name="title" required maxLength={180} placeholder="Scrivi un titolo chiaro"/></label>
    {needsAmount && <label>Importo (€)<input name="amount" type="number" min="0" step="0.01" required placeholder="0,00"/></label>}
    {(page === "events" || page === "tasks" || needsAmount) && <label>{page === "tasks" ? "Data di scadenza" : "Data"}<input name="dueDate" type="date"/></label>}
    {(page === "expenses" || page === "invoices" || page === "employees" || page === "events") && <label>Categoria<select name="category">{categoryOptions.map(option => <option key={option}>{option}</option>)}</select></label>}
    {page === "invoices" && <label>Numero fattura<input name="invoiceNumber" placeholder="Es. 2026/001"/></label>}
    {page === "employees" && <><label>Ruolo / mansione<input name="role" placeholder="Es. Addetta, tecnico…"/></label><label>Telefono o email<input name="contact" placeholder="Recapito del collaboratore"/></label></>}
    {page === "contacts" && <><label>Nome azienda / referente<input name="company" placeholder="Azienda o persona"/></label><label>Email o telefono<input name="contact" placeholder="Recapito"/></label></>}
    {page === "notes" && <label>Testo<textarea name="body" rows={4} placeholder="Scrivi la tua nota…"/></label>}
    {page === "tasks" && <label>Priorità<select name="priority"><option>Normale</option><option>Alta</option><option>Bassa</option></select></label>}
    <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Annulla</button><button className="button primary">Salva</button></div>
  </form>;
}
