'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function PlaceDetailPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sites/${id}`).then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then(setSite).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="detail-shell"><div className="loading-glass">Cargando ficha del local…</div></main>;
  if (!site) return <main className="detail-shell"><div className="loading-glass">No encontramos este local.</div></main>;

  return (
    <main className="detail-shell">
      <section className="detail-hero liquid-panel">
        <div className="hero-copy">
          <span className="eyebrow">{site.barrio?.localidad || 'BOGOTÁ'} · {site.categoria}</span>
          <h1>{site.nombre}</h1>
          <p>{site.descripcion || 'Este local todavía está construyendo su ficha comunitaria.'}</p>
          <div className="hero-meta">
            <span>★ {Number(site.rating_promedio || 0).toFixed(1)}</span>
            <span>{site.total_reviews || 0} reseñas</span>
            <span>{site.total_reviews_verificadas || 0} verificadas</span>
            <span>Confianza {Number(site.trust_score || 0).toFixed(0)}</span>
          </div>
          <div className="hero-actions">
            <Link href={`/app/locales/${site.id}/clasificar`} className="primary-action">Clasificar este local</Link>
            <Link href="/app" className="secondary-action">Volver al mapa</Link>
          </div>
        </div>
        <div className="rating-orb"><strong>{Number(site.rating_promedio || 0).toFixed(1)}</strong><small>ROLLING SCORE</small></div>
      </section>

      <section className="detail-grid">
        <article className="info-card liquid-panel">
          <span className="eyebrow">INFORMACIÓN</span>
          <h2>Datos del lugar</h2>
          <dl>
            <div><dt>Dirección</dt><dd>{site.direccion || 'Sin dirección publicada'}</dd></div>
            <div><dt>Localidad</dt><dd>{site.barrio?.localidad || 'Bogotá'}</dd></div>
            <div><dt>Categoría</dt><dd>{site.categoria || 'Local'}</dd></div>
            <div><dt>Teléfono</dt><dd>{site.telefono || 'No informado'}</dd></div>
          </dl>
          {site.website && <a className="website-link" href={site.website} target="_blank" rel="noreferrer">Abrir sitio web ↗</a>}
        </article>

        <article className="info-card liquid-panel">
          <span className="eyebrow">ACTIVIDAD</span>
          <h2>Eventos próximos</h2>
          <div className="stack-list">
            {(site.events || []).slice(0, 5).map((event) => <div className="mini-liquid" key={event.id}><strong>{event.titulo}</strong><span>{event.fecha_inicio} · {event.hora || 'Hora por confirmar'}</span></div>)}
            {(!site.events || site.events.length === 0) && <p className="muted">Aún no hay eventos publicados.</p>}
          </div>
        </article>

        <article className="reviews-card liquid-panel">
          <div className="reviews-heading"><div><span className="eyebrow">COMUNIDAD</span><h2>Reseñas recientes</h2></div><Link href={`/app/locales/${site.id}/clasificar`}>Agregar reseña</Link></div>
          <div className="reviews-grid">
            {(site.reviews || []).slice(0, 8).map((review) => <article className="review-card" key={review.id}><div><strong>★ {review.rating}.0</strong><span>{review.user?.username || 'Vecino Rolling'}</span></div><h3>{review.titulo || 'Experiencia comunitaria'}</h3><p>{review.comentario}</p>{review.verificada && <small>✓ Visita verificada</small>}</article>)}
            {(!site.reviews || site.reviews.length === 0) && <div className="empty-review"><strong>Sé la primera persona en clasificarlo</strong><span>Tu experiencia ayuda a construir el ranking real de Bogotá.</span></div>}
          </div>
        </article>
      </section>

      <style jsx>{`
        .detail-shell{min-height:calc(100vh - 65px);padding:34px clamp(16px,4vw,58px) 70px;background:radial-gradient(circle at 8% 6%,rgba(99,102,241,.12),transparent 28%),radial-gradient(circle at 90% 30%,rgba(14,165,233,.11),transparent 26%),linear-gradient(145deg,#edf2f4,#e5e9ed)}.liquid-panel{background:linear-gradient(145deg,rgba(255,255,255,.76),rgba(255,255,255,.48));border:1px solid rgba(255,255,255,.82);backdrop-filter:blur(28px) saturate(145%);box-shadow:0 24px 60px rgba(51,65,85,.12),inset 0 1px 0 #fff}.detail-hero{max-width:1400px;margin:auto;border-radius:32px;padding:clamp(28px,5vw,64px);display:grid;grid-template-columns:1fr auto;align-items:center;gap:40px;overflow:hidden;position:relative}.detail-hero:after{content:'';position:absolute;width:280px;height:280px;border-radius:50%;right:-100px;top:-120px;background:radial-gradient(circle,rgba(99,102,241,.18),transparent 65%)}.hero-copy{position:relative;z-index:2}.hero-copy h1{font-size:clamp(2.5rem,6vw,5rem);letter-spacing:-.055em;margin:8px 0 14px;line-height:.95}.hero-copy p{max-width:780px;color:#64748b;font-size:1.02rem;line-height:1.7}.eyebrow{font-size:.66rem;font-weight:900;letter-spacing:.14em;color:#6366f1}.hero-meta{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.hero-meta span{padding:8px 11px;border-radius:12px;background:rgba(255,255,255,.56);box-shadow:inset 0 0 0 1px rgba(148,163,184,.15);font-size:.78rem;font-weight:800;color:#475569}.hero-actions{display:flex;gap:10px;margin-top:22px}.primary-action,.secondary-action{padding:13px 17px;border-radius:14px;font-weight:900}.primary-action{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 11px 25px rgba(79,70,229,.25)}.secondary-action{background:#edf1f3;box-shadow:7px 7px 15px rgba(71,85,105,.12),-7px -7px 15px rgba(255,255,255,.95)}.rating-orb{width:160px;height:160px;border-radius:50%;display:grid;place-items:center;align-content:center;background:linear-gradient(145deg,#f6f8fa,#dde4e8);box-shadow:14px 14px 30px rgba(71,85,105,.18),-14px -14px 30px #fff,inset 0 0 0 1px rgba(255,255,255,.7);position:relative;z-index:2}.rating-orb strong{font-size:3.5rem;line-height:1;color:#4f46e5}.rating-orb small{font-size:.58rem;letter-spacing:.14em;color:#64748b;font-weight:900}.detail-grid{max-width:1400px;margin:22px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:18px}.info-card,.reviews-card{border-radius:25px;padding:24px}.info-card h2,.reviews-card h2{margin:5px 0 18px}.info-card dl{display:grid;gap:9px}.info-card dl>div{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid rgba(148,163,184,.15)}dt{font-size:.72rem;font-weight:900;color:#64748b}dd{margin:0;color:#1e293b;font-weight:700}.website-link{display:inline-block;margin-top:14px;color:#4f46e5;font-weight:900}.stack-list{display:grid;gap:9px}.mini-liquid{display:grid;gap:3px;padding:13px 14px;border-radius:15px;background:rgba(255,255,255,.5);box-shadow:0 8px 18px rgba(51,65,85,.06),inset 0 1px 0 #fff}.mini-liquid span,.muted{font-size:.78rem;color:#64748b}.reviews-card{grid-column:1/-1}.reviews-heading{display:flex;justify-content:space-between;align-items:center}.reviews-heading a{color:#4f46e5;font-weight:900;font-size:.8rem}.reviews-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.review-card{padding:17px;border-radius:18px;background:rgba(255,255,255,.52);border:1px solid rgba(255,255,255,.75);box-shadow:0 9px 20px rgba(51,65,85,.06)}.review-card>div{display:flex;justify-content:space-between}.review-card>div strong{color:#f59e0b}.review-card>div span,.review-card small{font-size:.7rem;color:#64748b}.review-card h3{font-size:.95rem;margin:12px 0 6px}.review-card p{font-size:.82rem;line-height:1.55;color:#475569}.empty-review{grid-column:1/-1;display:grid;text-align:center;gap:5px;padding:35px;border-radius:18px;background:rgba(255,255,255,.4);color:#64748b}.empty-review strong{color:#334155}.loading-glass{max-width:500px;margin:100px auto;padding:30px;text-align:center;border-radius:24px;background:rgba(255,255,255,.65);backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(51,65,85,.12)}@media(max-width:800px){.detail-hero{grid-template-columns:1fr}.rating-orb{width:110px;height:110px}.rating-orb strong{font-size:2.3rem}.detail-grid{grid-template-columns:1fr}.reviews-card{grid-column:auto}.reviews-grid{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
