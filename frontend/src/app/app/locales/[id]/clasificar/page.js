'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const steps = ['Puntuación', 'Experiencia', 'Validación'];

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
    fetch(`/api/sites/${id}`).then((r) => r.ok ? r.json() : null).then(setSite).catch(() => {});
  }, [id]);

  const canContinue = useMemo(() => {
    if (step === 0) return Number(form.rating) >= 1;
    if (step === 1) return form.comentario.trim().length >= 12;
    return true;
  }, [step, form]);

  async function submit() {
    setLoading(true); setMessage('Publicando tu clasificación…');
    try {
      const response = await fetch(`/api/sites/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ username: user?.username, rating: Number(form.rating), titulo: form.titulo, comentario: form.comentario, verificada: form.verificada })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo publicar la clasificación');
      setMessage('Clasificación publicada. El Rolling Score se actualizó.');
      setTimeout(() => router.push(`/app/locales/${id}`), 650);
    } catch (error) { setMessage(error.message); }
    setLoading(false);
  }

  if (!site) return <main className="classify-shell"><div className="classify-card">Cargando local…</div></main>;

  return (
    <main className="classify-shell">
      <section className="classify-intro">
        <span className="eyebrow">CLASIFICACIÓN COMUNITARIA</span>
        <h1>{site.nombre}</h1>
        <p>Tu experiencia alimenta el ranking real de lugares en Bogotá. Sé específico y útil para otras personas.</p>
      </section>

      <section className="classify-card liquid-panel">
        <div className="stepper">
          {steps.map((label, index) => <div key={label} className={`step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}><span>{index < step ? '✓' : index + 1}</span><small>{label}</small></div>)}
        </div>

        <div className="classify-body">
          {step === 0 && <>
            <span className="eyebrow">PASO 1</span><h2>¿Cómo calificas tu experiencia?</h2>
            <div className="rating-picker">
              {[1,2,3,4,5].map((rating) => <button type="button" key={rating} className={Number(form.rating) === rating ? 'rating-option active' : 'rating-option'} onClick={() => setForm((f) => ({ ...f, rating }))}><strong>{rating}</strong><span>{rating <= 2 ? 'Mala' : rating === 3 ? 'Regular' : rating === 4 ? 'Buena' : 'Excelente'}</span></button>)}
            </div>
          </>}

          {step === 1 && <>
            <span className="eyebrow">PASO 2</span><h2>Cuenta qué viviste</h2>
            <label>Título <span>opcional</span><input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ej. Excelente café para trabajar" /></label>
            <label>Reseña<textarea rows="7" value={form.comentario} onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))} placeholder="¿Qué pediste, cómo fue el servicio, el ambiente y qué deberían saber otros visitantes?" /></label>
          </>}

          {step === 2 && <>
            <span className="eyebrow">PASO 3</span><h2>Confirma tu aporte</h2>
            <div className="summary-card"><div><small>PUNTUACIÓN</small><strong>★ {form.rating}.0</strong></div><div><small>RESEÑA</small><p>{form.comentario}</p></div></div>
            <label className="verify-toggle"><input type="checkbox" checked={form.verificada} onChange={(e) => setForm((f) => ({ ...f, verificada: e.target.checked }))} /><span><strong>Visité este lugar</strong><small>Marca esta opción sólo si tu experiencia corresponde a una visita real.</small></span></label>
          </>}
        </div>

        {message && <div className="message">{message}</div>}
        <footer><button type="button" className="back" disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)}>Atrás</button>{step < 2 ? <button type="button" className="next" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>Continuar</button> : <button type="button" className="next" disabled={loading} onClick={submit}>{loading ? 'Publicando…' : 'Publicar clasificación'}</button>}</footer>
      </section>

      <style jsx>{`
        .classify-shell{min-height:calc(100vh - 65px);padding:44px 20px 70px;background:radial-gradient(circle at 20% 10%,rgba(124,58,237,.13),transparent 28%),radial-gradient(circle at 80% 30%,rgba(14,165,233,.1),transparent 25%),linear-gradient(145deg,#edf2f4,#e4e9ed)}.classify-intro{max-width:760px;margin:0 auto 23px;text-align:center}.classify-intro h1{font-size:clamp(2rem,5vw,3.6rem);letter-spacing:-.045em;margin:6px 0 10px}.classify-intro p{color:#64748b;line-height:1.6}.liquid-panel{max-width:760px;margin:auto;border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,255,255,.48));border:1px solid rgba(255,255,255,.84);backdrop-filter:blur(28px) saturate(145%);box-shadow:0 28px 70px rgba(51,65,85,.14),inset 0 1px 0 #fff;overflow:hidden}.stepper{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:24px 30px;border-bottom:1px solid rgba(148,163,184,.15)}.step{display:grid;justify-items:center;gap:7px;color:#94a3b8}.step>span{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#e9eef1;box-shadow:5px 5px 11px rgba(71,85,105,.14),-5px -5px 11px #fff;font-weight:900}.step small{font-size:.68rem;font-weight:900}.step.active>span{background:linear-gradient(135deg,#4f46e5,#8b5cf6);color:#fff;box-shadow:0 8px 18px rgba(79,70,229,.28)}.step.done>span{background:#dcfce7;color:#15803d}.classify-body{min-height:390px;padding:38px 42px;display:grid;align-content:start;gap:18px}.eyebrow{font-size:.64rem;font-weight:900;letter-spacing:.14em;color:#6366f1}.classify-body h2{font-size:1.55rem;margin:-6px 0 7px}.rating-picker{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:13px}.rating-option{padding:16px 7px;border-radius:17px;background:#ebeff2;box-shadow:7px 7px 15px rgba(71,85,105,.12),-7px -7px 15px #fff;display:grid;gap:5px;transition:.2s}.rating-option strong{font-size:1.8rem}.rating-option span{font-size:.68rem;color:#64748b}.rating-option.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 12px 25px rgba(79,70,229,.25);transform:translateY(-3px)}.rating-option.active span{color:#e0e7ff}.classify-body label{display:grid;gap:7px;font-size:.8rem;font-weight:900;color:#334155}.classify-body label>span{font-weight:500;color:#94a3b8}.classify-body input[type=text],.classify-body input:not([type]),.classify-body textarea{border:0;outline:none;border-radius:15px;padding:13px 15px;background:#edf1f3;box-shadow:inset 5px 5px 12px rgba(71,85,105,.09),inset -5px -5px 12px #fff;resize:vertical}.summary-card{display:grid;gap:10px}.summary-card>div{padding:15px;border-radius:17px;background:rgba(255,255,255,.55);box-shadow:0 8px 19px rgba(51,65,85,.06),inset 0 1px 0 #fff;display:grid;gap:4px}.summary-card small{font-size:.62rem;letter-spacing:.12em;color:#6366f1;font-weight:900}.summary-card p{margin:0;color:#475569;line-height:1.55}.verify-toggle{grid-template-columns:auto 1fr!important;align-items:flex-start!important;padding:15px;border-radius:17px;background:rgba(236,253,245,.64);border:1px solid rgba(16,185,129,.16)}.verify-toggle input{margin-top:4px}.verify-toggle span{display:grid;gap:3px;color:#166534!important}.verify-toggle small{color:#4b7b68}.message{margin:0 42px 18px;padding:11px 14px;border-radius:13px;background:rgba(238,242,255,.76);color:#4338ca;font-weight:800;font-size:.8rem}.classify-card footer{padding:20px 42px 28px;border-top:1px solid rgba(148,163,184,.14);display:flex;justify-content:space-between}.back,.next{padding:12px 20px;border-radius:14px;font-weight:900}.back{background:#e9eef1;box-shadow:6px 6px 14px rgba(71,85,105,.12),-6px -6px 14px #fff}.next{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 10px 23px rgba(79,70,229,.25)}button:disabled{opacity:.4}@media(max-width:650px){.classify-shell{padding:25px 10px}.classify-body{padding:28px 20px}.rating-picker{grid-template-columns:repeat(5,1fr);gap:5px}.rating-option{padding:12px 3px}.rating-option span{display:none}.classify-card footer{padding:18px 20px}.message{margin:0 20px 15px}}
      `}</style>
    </main>
  );
}
