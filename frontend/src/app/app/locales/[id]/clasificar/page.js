'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const steps = ['Calificación', 'Reseña', 'Confirmar'];
const ratings = [
  { value: 1, label: 'Muy mala', hint: 'No volvería' },
  { value: 2, label: 'Mala', hint: 'Debe mejorar' },
  { value: 3, label: 'Bien', hint: 'Cumplió' },
  { value: 4, label: 'Muy buena', hint: 'La recomiendo' },
  { value: 5, label: 'Excelente', hint: 'Imperdible' }
];

// Separamos puntuación, relato y confirmación para que reseñar sea una tarea
// corta en móvil, aunque al final se envía un único aporte.
export default function ClassifyPlacePage() {
  const { id } = useParams();
  const router = useRouter();
  const { token, user } = useAuth();
  const [site, setSite] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ rating: 5, titulo: '', comentario: '', verificada: false });

  useEffect(() => {
    fetch(`/api/sites/${id}`).then((response) => response.ok ? response.json() : null).then(setSite).catch(() => {});
  }, [id]);

  const canContinue = useMemo(() => {
    // Esta longitud coincide con la regla del backend y evita una ida innecesaria.
    if (step === 0) return Number(form.rating) >= 1;
    if (step === 1) return form.comentario.trim().length >= 12;
    return true;
  }, [step, form]);

  async function submit() {
    // La API asocia el aporte con la sesión y recalcula el Rolling Score.
    setLoading(true);
    setMessage('Publicando tu reseña…');
    try {
      const response = await fetch(`/api/sites/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ username: user?.username, rating: Number(form.rating), titulo: form.titulo, comentario: form.comentario, verificada: form.verificada })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo publicar la reseña');
      setMessage('Tu reseña quedó publicada. El Rolling Score ya fue actualizado.');
      setTimeout(() => router.push(`/app/locales/${id}`), 650);
    } catch (error) {
      setMessage(error.message);
    }
    setLoading(false);
  }

  if (!site) return <main className="review-loading"><span className="review-loading__mark">R</span><strong>Cargando lugar…</strong></main>;

  const selectedRating = ratings.find((item) => item.value === Number(form.rating));

  return (
    <main className="review-page">
      <div className="review-frame">
        <aside className="review-place">
          <Link href={`/app/locales/${id}`} className="review-back">← Volver al lugar</Link>
          <div className="review-place__content">
            <span className="review-place__kicker">Tu opinión importa</span>
            <h1>{site.nombre}</h1>
            <p>{site.descripcion || 'Ayuda a otras personas a saber qué pueden esperar de este lugar.'}</p>
            <dl>
              <div><dt>Categoría</dt><dd>{site.categoria}</dd></div>
              <div><dt>Zona</dt><dd>{site.barrio?.localidad || 'Bogotá'}</dd></div>
              <div><dt>Dirección</dt><dd>{site.direccion || 'Por confirmar'}</dd></div>
            </dl>
          </div>
          <div className="review-principle">
            <span>●</span>
            <p><strong>Una comunidad más útil</strong>Describe tu experiencia con claridad. No necesitas exagerar para que tu reseña cuente.</p>
          </div>
        </aside>

        <section className="review-form-card">
          <header className="review-form-head">
            <div>
              <span className="review-form-head__index">0{step + 1}</span>
              <div><small>Reseña comunitaria</small><strong>{steps[step]}</strong></div>
            </div>
            <span className="review-progress-copy">{step + 1} de {steps.length}</span>
          </header>

          <div className="review-progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>
            {steps.map((label, index) => (
              <div key={label} className={index <= step ? 'review-progress__item review-progress__item--active' : 'review-progress__item'}>
                <span />
                <small>{label}</small>
              </div>
            ))}
          </div>

          <div className="review-form-body">
            {step === 0 && (
              <div className="review-step">
                <div className="review-step__heading">
                  <span className="section-number">01</span>
                  <div><h2>¿Cómo estuvo tu experiencia?</h2><p>Elige la opción que mejor representa tu visita.</p></div>
                </div>
                <div className="rating-grid">
                  {ratings.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      className={Number(form.rating) === item.value ? 'rating-choice rating-choice--active' : 'rating-choice'}
                      onClick={() => setForm((current) => ({ ...current, rating: item.value }))}
                      aria-pressed={Number(form.rating) === item.value}
                    >
                      <span className="rating-choice__number">{item.value}</span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </button>
                  ))}
                </div>
                <div className="rating-selection"><span>Tu selección</span><strong>{form.rating}/5 · {selectedRating?.label}</strong></div>
              </div>
            )}

            {step === 1 && (
              <div className="review-step">
                <div className="review-step__heading">
                  <span className="section-number">02</span>
                  <div><h2>Cuéntanos qué pasó</h2><p>Los detalles concretos hacen que tu reseña sea más útil.</p></div>
                </div>
                <label className="review-field">
                  <span>Título <em>opcional</em></span>
                  <input value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} placeholder="Resume tu experiencia en una frase" maxLength="120" />
                </label>
                <label className="review-field">
                  <span>Tu experiencia</span>
                  <textarea rows="6" value={form.comentario} onChange={(event) => setForm((current) => ({ ...current, comentario: event.target.value }))} placeholder="¿Qué destacarías del servicio, el ambiente o la experiencia?" maxLength="1200" />
                  <small>{form.comentario.length}/1200 · mínimo 12 caracteres</small>
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="review-step">
                <div className="review-step__heading">
                  <span className="section-number">03</span>
                  <div><h2>Todo listo para publicar</h2><p>Revisa tu aporte antes de compartirlo con la comunidad.</p></div>
                </div>
                <div className="review-summary">
                  <div className="review-summary__score"><strong>{form.rating}.0</strong><span>de 5</span></div>
                  <div><small>{form.titulo || selectedRating?.label}</small><p>{form.comentario}</p></div>
                </div>
                <label className="visit-check">
                  <input type="checkbox" checked={form.verificada} onChange={(event) => setForm((current) => ({ ...current, verificada: event.target.checked }))} />
                  <span><strong>Confirmo que visité este lugar</strong><small>Esta señal mejora el peso de tu aporte en Rolling.</small></span>
                </label>
              </div>
            )}
          </div>

          {message && <div className="review-message" role="status">{message}</div>}

          <footer className="review-form-footer">
            <button type="button" className="button-quiet" disabled={step === 0 || loading} onClick={() => setStep((current) => current - 1)}>Atrás</button>
            {step < 2
              ? <button type="button" className="button-primary" disabled={!canContinue || loading} onClick={() => setStep((current) => current + 1)}>Continuar <span>→</span></button>
              : <button type="button" className="button-primary" disabled={loading} onClick={submit}>{loading ? 'Publicando…' : 'Publicar reseña'} <span>→</span></button>}
          </footer>
        </section>
      </div>

      <style jsx>{`
        .review-page{min-height:calc(100vh - 76px);padding:32px;background:#eeece5;color:#19241f}.review-frame{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,760px);max-width:1120px;min-height:650px;margin:0 auto;border:1px solid #d9d8d0;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 24px 70px rgba(25,38,31,.11)}.review-place{display:flex;flex-direction:column;padding:28px;color:#f8f6f0;background:#1b2b24}.review-back{width:max-content;color:#b8c4bd;font-size:var(--fs-info);font-weight:800}.review-back:hover{color:#fff}.review-place__content{margin:auto 0}.review-place__kicker{display:flex;align-items:center;gap:8px;color:#dbe9b5;font-size:var(--fs-comment);font-weight:900;letter-spacing:.13em;text-transform:uppercase}.review-place__kicker::before{content:"";width:22px;height:2px;background:#dbe9b5}.review-place h1{margin:15px 0 14px;font-family:var(--font-title);font-size:var(--fs-display);font-weight:500;line-height:1.08;letter-spacing:-.01em}.review-place__content>p{margin:0 0 28px;color:#b8c4bd;font-size:var(--fs-info);line-height:1.65}.review-place dl{display:grid;gap:0;margin:0}.review-place dl>div{display:grid;grid-template-columns:100px 1fr;gap:12px;padding:11px 0;border-top:1px solid rgba(255,255,255,.11)}.review-place dt{color:#7f9288;font-size:var(--fs-comment);font-weight:800;text-transform:uppercase}.review-place dd{margin:0;color:#edf1ee;font-size:var(--fs-info);line-height:1.4}.review-principle{display:grid;grid-template-columns:auto 1fr;gap:10px;padding-top:20px;border-top:1px solid rgba(255,255,255,.11)}.review-principle>span{color:#dbe9b5}.review-principle p{display:grid;gap:4px;margin:0;color:#94a69c;font-size:var(--fs-comment);line-height:1.45}.review-principle strong{color:#fff;font-size:var(--fs-info)}.review-form-card{display:flex;min-width:0;flex-direction:column;background:#fff}.review-form-head{display:flex;align-items:center;justify-content:space-between;padding:24px 30px 18px}.review-form-head>div{display:flex;align-items:center;gap:11px}.review-form-head__index{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;color:#1b2b24;background:#dbe9b5;font-size:var(--fs-comment);font-weight:900}.review-form-head div div{display:grid;gap:2px}.review-form-head small{color:#8b948f;font-size:var(--fs-comment);font-weight:800;letter-spacing:.1em;text-transform:uppercase}.review-form-head strong{font-family:var(--font-title);font-size:var(--fs-body)}.review-progress-copy{color:#7b857f;font-size:var(--fs-comment);font-weight:800}.review-progress{display:grid;grid-template-columns:repeat(3,1fr);padding:0 30px 20px}.review-progress__item{position:relative;display:grid;gap:7px;color:#9ba39f}.review-progress__item::before{position:absolute;top:4px;left:8px;right:-8px;height:1px;background:#dde0dc;content:""}.review-progress__item:last-child::before{right:calc(100% - 8px)}.review-progress__item span{position:relative;z-index:1;width:9px;height:9px;border:2px solid #fff;border-radius:50%;background:#cbd0cc;box-shadow:0 0 0 1px #cbd0cc}.review-progress__item small{font-size:var(--fs-comment);font-weight:800}.review-progress__item--active{color:#285f4a}.review-progress__item--active::before,.review-progress__item--active span{background:#285f4a}.review-progress__item--active span{box-shadow:0 0 0 1px #285f4a}.review-form-body{flex:1;padding:34px 42px;border-top:1px solid #ecece7;border-bottom:1px solid #ecece7}.review-step{display:grid;gap:22px}.review-step__heading{display:grid;grid-template-columns:38px 1fr;gap:14px;align-items:start}.section-number{padding-top:6px;color:#d25d41;font-size:var(--fs-comment);font-weight:900;letter-spacing:.08em}.review-step h2{margin:0 0 5px;font-family:var(--font-title);font-size:var(--fs-title);font-weight:600;letter-spacing:-.01em}.review-step__heading p{margin:0;color:#77827c;font-size:var(--fs-info);line-height:1.5}.rating-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.rating-choice{display:grid;justify-items:start;gap:4px;min-height:122px;border:1px solid #dfe1dc;border-radius:13px;padding:14px 11px;background:#f8f7f3;text-align:left;transition:transform .16s,border-color .16s,background .16s,color .16s}.rating-choice:hover{border-color:#aebbb4;transform:translateY(-2px)}.rating-choice__number{font-family:var(--font-title);font-size:var(--fs-title);line-height:1}.rating-choice strong{margin-top:auto;font-size:var(--fs-info)}.rating-choice small{color:#89928d;font-size:var(--fs-comment)}.rating-choice--active{border-color:#285f4a;color:#fff;background:#285f4a;box-shadow:0 10px 22px rgba(40,95,74,.18)}.rating-choice--active small{color:#c9d8d0}.rating-selection{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #ecece7;padding-top:16px;color:#7e8882;font-size:var(--fs-info)}.rating-selection strong{color:#285f4a}.review-field{display:grid;gap:8px;color:#334039;font-size:var(--fs-info);font-weight:900}.review-field>span{display:flex;gap:7px}.review-field em{color:#9ca49f;font-style:normal;font-weight:500}.review-field input,.review-field textarea{width:100%;border:1px solid #d9ddd8;border-radius:11px;padding:13px 14px;color:#1d2a24;background:#fbfaf7;outline:none;resize:vertical}.review-field input:focus,.review-field textarea:focus{border-color:#285f4a;box-shadow:0 0 0 3px rgba(40,95,74,.09)}.review-field>small{justify-self:end;color:#929b96;font-size:var(--fs-comment);font-weight:500}.review-summary{display:grid;grid-template-columns:110px 1fr;gap:18px;border:1px solid #dfe2dd;border-radius:14px;padding:18px;background:#f8f7f3}.review-summary__score{display:grid;place-content:center;border-right:1px solid #dfe2dd}.review-summary__score strong{font-family:var(--font-title);font-size:var(--fs-display);color:#285f4a}.review-summary__score span{color:#88928d;font-size:var(--fs-comment)}.review-summary>div:last-child{display:grid;align-content:center;gap:7px}.review-summary small{font-weight:900}.review-summary p{margin:0;color:#5f6b65;font-size:var(--fs-info);line-height:1.55}.visit-check{display:grid;grid-template-columns:auto 1fr;align-items:start;gap:11px;border:1px solid #d7ded8;border-radius:12px;padding:14px;background:#f2f6f2}.visit-check input{width:17px;height:17px;margin-top:2px;accent-color:#285f4a}.visit-check span{display:grid;gap:3px}.visit-check strong{font-size:var(--fs-info)}.visit-check small{color:#748078;font-size:var(--fs-comment)}.review-message{margin:16px 30px 0;border-left:3px solid #285f4a;padding:10px 12px;color:#285f4a;background:#f0f5f1;font-size:var(--fs-info);font-weight:800}.review-form-footer{display:flex;justify-content:space-between;padding:20px 30px}.button-quiet,.button-primary{min-height:42px;border-radius:999px;padding:0 18px;font-size:var(--fs-info);font-weight:900}.button-quiet{border:1px solid #d9ddd8;background:#fff;color:#56625c}.button-primary{display:flex;align-items:center;gap:16px;color:#fff;background:#1b2b24}.button-primary span{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;color:#1b2b24;background:#dbe9b5}.button-primary:hover{background:#285f4a}.button-quiet:disabled,.button-primary:disabled{cursor:not-allowed;opacity:.38}.review-loading{display:grid;min-height:calc(100vh - 76px);place-content:center;justify-items:center;gap:10px;background:#eeece5}.review-loading__mark{display:grid;width:46px;height:46px;place-items:center;border-radius:50%;color:#1b2b24;background:#dbe9b5;font-family:var(--font-title);font-weight:900}
        @media(max-width:820px){.review-page{padding:14px}.review-frame{grid-template-columns:1fr}.review-place{min-height:330px}.review-place__content{margin:45px 0}.review-form-body{padding:30px 24px}.rating-grid{grid-template-columns:repeat(5,minmax(80px,1fr));overflow:auto;padding-bottom:5px}.rating-choice{min-width:80px}.review-form-head,.review-form-footer{padding-left:24px;padding-right:24px}.review-progress{padding-left:24px;padding-right:24px}}
        @media(max-width:520px){.review-page{padding:0}.review-frame{border:0;border-radius:0}.review-place{padding:22px}.review-place h1{font-size:var(--fs-display)}.review-form-body{padding:26px 18px}.review-step h2{font-size:var(--fs-title)}.review-summary{grid-template-columns:1fr}.review-summary__score{border-right:0;border-bottom:1px solid #dfe2dd;padding-bottom:12px}.review-form-head,.review-form-footer{padding-left:18px;padding-right:18px}}
      `}</style>
    </main>
  );
}
