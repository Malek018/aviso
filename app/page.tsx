'use client';
import {useEffect, useRef, useState} from 'react';

type Establishment = {
  id: string; name: string; category: string; city: string; address: string;
  phone?: string | null; description?: string | null; price?: string | null;
  availability?: string | null; formalised: boolean; statusOpen: boolean;
  status: 'ACTIVE' | 'DISABLED' | 'PENDING'; latitude?: number | null; longitude?: number | null;
  sinceYear?: number | null; mapsQuery?: string | null; disabledReason?: string | null;
  noGate: boolean; pct: number | null; avis: number;
};
type Review = {id: string; recommendation: boolean; text: string; type: 'ONSITE' | 'GENERAL'; createdAt: string};
type Fiche = Establishment & {reviews: Review[]};
type GateState = {seconds: number; unlocked: boolean; inRange: boolean; error: string | null};

const icons: Record<string, string> = {Restaurant: '🍽️', Coiffeur: '💈', 'Appartement meublé': '🏠', Livraison: '🛵'};
const RADIUS_M = 200, REQUIRED_MIN = 15;

function relTime(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'il y a 1 jour';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} semaine(s)`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function Home() {
  const [data, setData] = useState<Establishment[]>([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');

  const [fiche, setFiche] = useState<Fiche | null>(null);

  const [review, setReview] = useState<{est: Establishment; phase: 'gate' | 'form'; type: 'ONSITE' | 'GENERAL'} | null>(null);
  const [reco, setReco] = useState<'oui' | 'non' | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [gate, setGate] = useState<Record<string, GateState>>({});
  const geoRef = useRef<Record<string, {watchId: number | null; ticker: any; simHandle: any}>>({});

  const [bizOpen, setBizOpen] = useState(false);
  const [bizMode, setBizMode] = useState<'owner' | 'recommend'>('owner');
  const [biz, setBiz] = useState({name: '', category: 'Restaurant', city: '', address: '', phone: '', ifu: ''});

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminList, setAdminList] = useState<Establishment[]>([]);

  const load = () => fetch('/api/establishments').then(r => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const filtered = data.filter(b =>
    (!q || `${b.name} ${b.category}`.toLowerCase().includes(q.toLowerCase())) && (!city || b.city === city)
  );

  function closeAll() {
    setFiche(null); setReview(null);
    Object.values(geoRef.current).forEach(w => {
      if (w.watchId != null) navigator.geolocation.clearWatch(w.watchId);
      if (w.ticker) clearInterval(w.ticker);
      if (w.simHandle) clearInterval(w.simHandle);
    });
  }

  async function openFiche(id: string) {
    const f: Fiche = await fetch(`/api/establishments/${id}`).then(r => r.json());
    setFiche(f);
  }

  function ensureGeo(id: string) {
    if (!geoRef.current[id]) geoRef.current[id] = {watchId: null, ticker: null, simHandle: null};
    return geoRef.current[id];
  }

  function startTracking(est: Establishment) {
    const w = ensureGeo(est.id);
    if (!navigator.geolocation) {
      setGate(g => ({...g, [est.id]: {...(g[est.id] || {seconds: 0, unlocked: false, inRange: false}), error: "La géolocalisation n'est pas disponible sur cet appareil ou ce navigateur."}}));
      return;
    }
    if (w.watchId != null) return;
    w.watchId = navigator.geolocation.watchPosition(
      pos => {
        const d = haversine(pos.coords.latitude, pos.coords.longitude, est.latitude || 0, est.longitude || 0);
        setGate(g => ({...g, [est.id]: {...(g[est.id] || {seconds: 0, unlocked: false}), inRange: d <= RADIUS_M, error: null}}));
      },
      err => {
        setGate(g => ({...g, [est.id]: {...(g[est.id] || {seconds: 0, unlocked: false, inRange: false}), error: err.code === 1 ? 'Position refusée — vous pouvez utiliser la simulation ci-dessous.' : 'Position indisponible pour le moment.'}}));
      },
      {enableHighAccuracy: true, maximumAge: 5000, timeout: 10000}
    );
    if (!w.ticker) {
      w.ticker = setInterval(() => {
        setGate(g => {
          const cur = g[est.id] || {seconds: 0, unlocked: false, inRange: false, error: null};
          if (cur.inRange && !cur.unlocked) {
            const seconds = cur.seconds + 5;
            const unlocked = seconds >= REQUIRED_MIN * 60;
            if (unlocked) stopTracking(est.id);
            return {...g, [est.id]: {...cur, seconds, unlocked}};
          }
          return g;
        });
      }, 5000);
    }
  }

  function stopTracking(id: string) {
    const w = geoRef.current[id];
    if (!w) return;
    if (w.watchId != null) { navigator.geolocation.clearWatch(w.watchId); w.watchId = null; }
    if (w.ticker) { clearInterval(w.ticker); w.ticker = null; }
    if (w.simHandle) { clearInterval(w.simHandle); w.simHandle = null; }
  }

  function simulatePresence(est: Establishment) {
    const w = ensureGeo(est.id);
    if (w.simHandle || gate[est.id]?.unlocked) return;
    setGate(g => ({...g, [est.id]: {...(g[est.id] || {seconds: 0}), inRange: true, error: null, unlocked: false}}));
    let step = 0;
    w.simHandle = setInterval(() => {
      step++;
      const seconds = step * 60, unlocked = step >= REQUIRED_MIN;
      if (unlocked) { clearInterval(w.simHandle); w.simHandle = null; }
      setGate(g => ({...g, [est.id]: {...(g[est.id] || {}), seconds, unlocked, inRange: true, error: null}}));
    }, 300);
  }

  function openReview(est: Establishment) {
    setFiche(null);
    if (est.noGate) { setReview({est, phase: 'form', type: 'GENERAL'}); return; }
    if (gate[est.id]?.unlocked) { setReview({est, phase: 'form', type: 'ONSITE'}); return; }
    setReview({est, phase: 'gate', type: 'ONSITE'});
  }

  async function submitReview() {
    if (!review || !reco) { alert('Merci de préciser si vous recommandez ce lieu.'); return; }
    await fetch('/api/reviews', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({establishmentId: review.est.id, recommendation: reco === 'oui', text: reviewText, type: review.type}),
    });
    alert(reco === 'oui' ? 'Merci ! Votre réponse est enregistrée.' : 'Merci pour votre retour, il est enregistré.');
    setReviewText(''); setReco(null); setReview(null);
    load();
  }

  function setAddMode(m: 'owner' | 'recommend') { setBizMode(m); }

  async function submitBusiness() {
    if (!biz.name || !biz.city) { alert("Merci d'indiquer au moins le nom et la ville."); return; }
    await fetch('/api/establishments', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...biz, mode: bizMode}),
    });
    alert(bizMode === 'owner' ? 'Fiche publiée. Elle est visible immédiatement dans les résultats de recherche.' : 'Merci ! Nous vérifions les informations avant publication, généralement sous 48h.');
    setBiz({name: '', category: 'Restaurant', city: '', address: '', phone: '', ifu: ''});
    setBizOpen(false);
    load();
  }

  async function openAdmin() {
    const all: Establishment[] = await fetch('/api/admin/establishments').then(r => r.json());
    setAdminList(all);
    setAdminOpen(true);
  }

  async function reactivate(id: string) {
    await fetch(`/api/establishments/${id}`, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'reactivate'})});
    openAdmin(); load();
  }

  async function simulateDegradation(id: string) {
    await fetch('/api/admin/simulate', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({establishmentId: id})});
    openAdmin(); load();
  }

  function contact(est: Establishment | Fiche) {
    if (est.phone) window.open(`https://wa.me/${est.phone.replace(/\D/g, '')}`, '_blank', 'noopener');
    else alert('Numéro non renseigné pour cet établissement.');
  }

  function directions(est: Establishment | Fiche) {
    const query = est.mapsQuery || est.address;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
  }

  const disabledList = adminList.filter(e => e.status === 'DISABLED');
  const pendingList = adminList.filter(e => e.status === 'PENDING');
  const activeList = adminList.filter(e => e.status === 'ACTIVE');

  return (
    <>
      <header className="nav">
        <div className="logo">AVIS<span>O</span></div>
        <button className="btn primary" onClick={() => setBizOpen(true)}>Ajouter mon établissement</button>
      </header>

      <section className="hero">
        <div className="heroIn">
          <div className="eyebrow">🇧🇯 La confiance locale, simplement</div>
          <h1>Avant de choisir, consultez les recommandations.</h1>
          <p>Découvrez les restaurants, coiffeurs, appartements meublés et services de livraison les plus recommandés au Bénin — par de vrais visiteurs, après leur passage.</p>
          <div className="search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Que recherchez-vous ? Ex. coiffeur, restaurant…" />
            <select value={city} onChange={e => setCity(e.target.value)}>
              <option value="">Toute ville</option>
              <option>Cotonou</option><option>Abomey-Calavi</option><option>Porto-Novo</option>
            </select>
            <button className="btn primary">Rechercher</button>
          </div>
        </div>
      </section>

      <main>
        <section>
          <div className="sectionTitle"><h2>Explorer par catégorie</h2></div>
          <div className="grid">
            {Object.entries(icons).map(([k, v]) => (
              <div className="cat" key={k} onClick={() => setQ(k)}>
                <span className="ico">{v}</span>{k}s
              </div>
            ))}
          </div>
        </section>

        <section style={{marginTop: 45}}>
          <div className="sectionTitle"><h2>Comment fonctionne la note de confiance</h2></div>
          <div className="grid" style={{gridTemplateColumns: 'repeat(3,1fr)'}}>
            <div className="cat static">
              <span className="ico">1️⃣</span>
              <div style={{marginBottom: 4, fontWeight: 800}}>Une visite</div>
              <p className="muted">Le client se rend chez le prestataire, comme d&apos;habitude.</p>
            </div>
            <div className="cat static">
              <span className="ico">💬</span>
              <div style={{marginBottom: 4, fontWeight: 800}}>Une question par WhatsApp</div>
              <p className="muted">« Recommanderiez-vous ce lieu ? » — une réponse Oui/Non suffit, sans ouvrir d&apos;appli.</p>
            </div>
            <div className="cat static">
              <span className="ico">📊</span>
              <div style={{marginBottom: 4, fontWeight: 800}}>Un taux affiché</div>
              <p className="muted">Le pourcentage de « Oui » sur les derniers mois s&apos;affiche sur chaque fiche.</p>
            </div>
          </div>
        </section>

        <section style={{marginTop: 45}}>
          <div className="sectionTitle">
            <h2>Établissements populaires</h2>
            <span className="muted">{filtered.length} résultat(s)</span>
          </div>
          <div className="cards">
            {filtered.map(b => (
              <article className="card" key={b.id}>
                <div className="cover" onClick={() => openFiche(b.id)} style={{cursor: 'pointer'}}>{icons[b.category] || '⭐'}</div>
                <div className="content">
                  <h3 style={{cursor: 'pointer'}} onClick={() => openFiche(b.id)}>{b.name}</h3>
                  <div><span className="reco">{b.pct ?? 0}%</span> <span className="muted">recommandent · {b.avis} avis</span></div>
                  <div>
                    <span className="tag">{b.category} · {b.city}</span>
                    {b.formalised && <span className="badge badge-verified">✓ Formalisé</span>}
                    {b.statusOpen ? <span className="badge badge-verified">● Ouvert</span> : <span className="badge badge-warn">● Fermé</span>}
                  </div>
                  <p className="muted">{b.description}</p>
                  <button className="btn secondary full" onClick={() => openReview(b)}>Donner un avis</button>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && <p className="muted" style={{textAlign: 'center', padding: 30}}>Aucun établissement trouvé.</p>}
        </section>
      </main>

      <footer>
        AVISO — La plateforme béninoise des avis et de la confiance.<br />
        <a href="#" onClick={e => { e.preventDefault(); openAdmin(); }} style={{color: '#9fb0a8', fontSize: 11}}>Espace admin (démo)</a>
      </footer>

      {fiche && (
        <div className="modal" onClick={() => closeAll()}>
          <div className="modal-box wide" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => closeAll()}>×</button>
            <h2>{fiche.name}</h2>
            <div style={{marginBottom: 4}}>
              {fiche.formalised && <span className="badge badge-verified">✓ Formalisé (IFU)</span>}
              {fiche.statusOpen ? <span className="badge badge-verified">● Ouvert / disponible</span> : <span className="badge badge-warn">● Fermé actuellement</span>}
            </div>
            <div className="muted" style={{marginBottom: 6}}>{fiche.category} · {fiche.city}</div>
            <div className="stats3">
              <div className="s"><b>{fiche.pct ?? 0}%</b><small>Recommandation</small></div>
              <div className="divider" />
              <div className="s"><b>{fiche.avis}</b><small>Avis</small></div>
              <div className="divider" />
              <div className="s"><b>{fiche.sinceYear ?? '—'}</b><small>Sur AVISO depuis</small></div>
            </div>
            <p style={{lineHeight: 1.6, marginTop: 0}}>{fiche.description}</p>
            <span className="label">Tarif indicatif</span><p className="muted" style={{marginTop: 2}}>{fiche.price}</p>
            <span className="label">Adresse</span><p className="muted" style={{lineHeight: 1.5, marginTop: 2}}>{fiche.address}</p>
            <span className="label">Disponibilité</span><p className="muted" style={{marginTop: 2}}>{fiche.availability}</p>
            <span className="label">Avis récents</span>
            <div style={{marginTop: 6}}>
              {fiche.reviews.map(r => (
                <div className="review-mini" key={r.id}>
                  <div className="rh"><span>{r.type === 'ONSITE' ? '✅ sur place' : '💬 général'}</span><span>{relTime(r.createdAt)}</span></div>
                  <div>{r.text}</div>
                </div>
              ))}
              {fiche.reviews.length === 0 && <p className="muted">Aucun avis pour le moment.</p>}
            </div>
            <div style={{display: 'flex', gap: 10, marginTop: 14}}>
              <button className="btn primary" style={{flex: 1}} onClick={() => contact(fiche)}>Contacter</button>
              <button className="btn secondary" style={{flex: 1}} onClick={() => directions(fiche)}>S&apos;y rendre</button>
            </div>
          </div>
        </div>
      )}

      {review && (
        <div className="modal" onClick={() => closeAll()}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => closeAll()}>×</button>
            <h2>Donner un avis</h2>

            {review.phase === 'gate' && (() => {
              const g = gate[review.est.id] || {seconds: 0, unlocked: false, inRange: false, error: null};
              const pct = Math.min(100, Math.round((g.seconds / (REQUIRED_MIN * 60)) * 100));
              return (
                <div className="form">
                  <p className="muted" style={{marginTop: 0}}>
                    Pour garantir des avis authentiques, la notation se débloque après environ {REQUIRED_MIN} minutes passées sur place ({review.est.address.split(',').slice(0, 2).join(',')}).
                  </p>
                  <div className="gate-progress"><span style={{width: `${pct}%`}} /></div>
                  {g.unlocked ? (
                    <div className="gate-line ok">✅ Vous pouvez maintenant donner votre avis</div>
                  ) : g.error ? (
                    <div className="gate-line warn">{g.error}</div>
                  ) : (geoRef.current[review.est.id]?.watchId != null || geoRef.current[review.est.id]?.simHandle) ? (
                    <>
                      {g.inRange
                        ? <div className="gate-line ok">📍 Sur place — {Math.floor(g.seconds / 60)} min / {REQUIRED_MIN} min</div>
                        : <div className="gate-line warn">Position suivie, mais vous n&apos;êtes pas encore dans la zone du lieu.</div>}
                      <div className="gate-sub">Le suivi se met à jour automatiquement toutes les 5 secondes.</div>
                    </>
                  ) : (
                    <div className="gate-sub">Position non vérifiée pour le moment.</div>
                  )}
                  <div style={{marginTop: 6}}>
                    {g.unlocked ? (
                      <button className="btn primary full" onClick={() => setReview(r => r && {...r, phase: 'form', type: 'ONSITE'})}>Continuer vers l&apos;avis</button>
                    ) : (
                      <>
                        <div style={{display: 'flex', gap: 10}}>
                          <button className="btn primary" style={{flex: 1}} onClick={() => startTracking(review.est)}>📍 Activer ma position</button>
                          <button className="btn-ghost btn" style={{flex: 1}} onClick={() => simulatePresence(review.est)}>🧪 Simuler (démo)</button>
                        </div>
                        <div style={{textAlign: 'center', marginTop: 10}}>
                          <a href="#" onClick={e => { e.preventDefault(); setReview(r => r && {...r, phase: 'form', type: 'GENERAL'}); }} style={{fontSize: 12, color: 'var(--muted)'}}>
                            Laisser un avis général, sans vérification de présence
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="hint" style={{marginTop: 14}}>Ce système limite la notation aux personnes réellement passées sur place.</div>
                </div>
              );
            })()}

            {review.phase === 'form' && (
              <div className="form">
                <span className="label">Établissement</span>
                <input className="field" readOnly value={review.est.name} />
                <div style={{margin: '-4px 0 10px'}}>
                  {review.type === 'ONSITE'
                    ? <span className="badge badge-verified">✅ Avis vérifié sur place</span>
                    : <span className="badge">💬 Avis général (non vérifié sur place)</span>}
                </div>
                <span className="label">Recommanderiez-vous ce lieu ?</span>
                <div className="yn">
                  <button type="button" className={reco === 'oui' ? 'active' : ''} onClick={() => setReco('oui')}>Oui</button>
                  <button type="button" className={reco === 'non' ? 'active' : ''} onClick={() => setReco('non')}>Non</button>
                </div>
                <div className="hint">Vous pourrez aussi répondre directement par WhatsApp après votre prochaine visite.</div>
                <span className="label">Un mot pour les prochains visiteurs (facultatif)</span>
                <textarea rows={4} placeholder="Partagez votre expérience..." value={reviewText} onChange={e => setReviewText(e.target.value)} />
                <button className="btn primary full" onClick={submitReview}>Publier ma réponse</button>
              </div>
            )}
          </div>
        </div>
      )}

      {bizOpen && (
        <div className="modal" onClick={() => setBizOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setBizOpen(false)}>×</button>
            <h2>Ajouter un établissement</h2>
            <div className="form">
              <div className="mode-toggle">
                <button type="button" className={bizMode === 'owner' ? 'active' : ''} onClick={() => setAddMode('owner')}>C&apos;est mon établissement</button>
                <button type="button" className={bizMode === 'recommend' ? 'active' : ''} onClick={() => setAddMode('recommend')}>Je recommande un lieu</button>
              </div>
              <span className="label">Nom de l&apos;établissement</span>
              <input className="field" placeholder="Ex. Chez Jean Restaurant" value={biz.name} onChange={e => setBiz({...biz, name: e.target.value})} />
              <span className="label">Catégorie</span>
              <select className="field" value={biz.category} onChange={e => setBiz({...biz, category: e.target.value})}>
                <option>Restaurant</option><option>Coiffeur</option><option>Appartement meublé</option><option>Livraison</option><option>Autre service</option>
              </select>
              <span className="label">Ville</span>
              <input className="field" placeholder="Cotonou" value={biz.city} onChange={e => setBiz({...biz, city: e.target.value})} />
              <span className="label">Repère / complément d&apos;adresse</span>
              <textarea rows={2} placeholder="Ex : à côté de la pharmacie Étoile, portail vert" value={biz.address} onChange={e => setBiz({...biz, address: e.target.value})} />
              <div className="hint">C&apos;est souvent ce repère, plus que l&apos;adresse GPS, qui permet aux visiteurs de trouver le lieu.</div>
              <span className="label">Téléphone / WhatsApp de l&apos;établissement</span>
              <input className="field" placeholder="90 XX XX XX" value={biz.phone} onChange={e => setBiz({...biz, phone: e.target.value})} />
              {bizMode === 'owner' ? (
                <>
                  <span className="label">IFU (facultatif)</span>
                  <input className="field" placeholder="Ex : 3 2019 xxxxxx" value={biz.ifu} onChange={e => setBiz({...biz, ifu: e.target.value})} />
                  <div className="hint">Le renseigner donne le badge <b>Formalisé</b>, un repère de confiance en plus. Sans IFU, votre fiche reste publiable.</div>
                </>
              ) : (
                <div className="hint" style={{borderTop: '1px solid var(--line)', paddingTop: 10}}>
                  Ce lieu sera vérifié par notre équipe (appel ou passage sur place) avant publication, pour éviter les fiches erronées ou en double.
                </div>
              )}
              <button className="btn primary full" onClick={submitBusiness}>{bizMode === 'owner' ? 'Publier ma fiche' : 'Envoyer pour vérification'}</button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div className="modal" onClick={() => setAdminOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <button className="close" onClick={() => setAdminOpen(false)}>×</button>
            <h2>Espace admin (démo)</h2>
            <div className="form">
              <p className="muted" style={{marginTop: 0}}>
                Un établissement est retiré automatiquement des résultats si son taux de recommandation tombe à 40% ou moins, sur au moins 5 avis vérifiés sur place.
              </p>
              {pendingList.length > 0 && (
                <>
                  <span className="label">En attente de vérification</span>
                  <div style={{marginTop: 8}}>
                    {pendingList.map(e => (
                      <div className="review-mini" key={e.id}>
                        <div className="rh"><span>{e.name}</span><span>{e.city}</span></div>
                        <button type="button" className="btn secondary" style={{width: '100%'}} onClick={() => reactivate(e.id)}>Publier</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <span className="label">Établissements désactivés</span>
              <div style={{marginTop: 8}}>
                {disabledList.length === 0 && <p className="muted">Aucun établissement désactivé pour le moment.</p>}
                {disabledList.map(e => (
                  <div className="review-mini" key={e.id}>
                    <div className="rh"><span>{e.name}</span><span>{e.pct}% · {e.avis} avis</span></div>
                    <div style={{marginBottom: 8}}>{e.disabledReason}</div>
                    <button type="button" className="btn secondary" style={{width: '100%'}} onClick={() => reactivate(e.id)}>Réactiver</button>
                  </div>
                ))}
              </div>
              <div style={{borderTop: '1px solid var(--line)', margin: '18px 0 10px', paddingTop: 14}}>
                <span className="label">🧪 Outils de démonstration</span>
                <div className="hint" style={{marginTop: 2}}>Simule une série d&apos;avis négatifs sur un établissement actif, pour déclencher le seuil sans attendre de vrais avis.</div>
                <div style={{marginTop: 8}}>
                  {activeList.map(e => (
                    <div className="review-mini" key={e.id}>
                      <div className="rh"><span>{e.name}</span><span>{e.pct}% · {e.avis} avis</span></div>
                      <button type="button" className="btn-ghost btn" style={{width: '100%'}} onClick={() => simulateDegradation(e.id)}>Simuler une dégradation</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
