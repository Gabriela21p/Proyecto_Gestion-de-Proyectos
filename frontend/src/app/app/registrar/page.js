'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const steps = ['Identidad', 'Ubicación', 'Detalles', 'Revisión'];
const categories = ['Café', 'Restaurante', 'Bar', 'Panadería', 'Tienda', 'Cultura', 'Salud', 'Belleza', 'Fitness', 'Turismo', 'Otro'];

// El registro se divide en pasos cortos: identidad, ubicación, contexto y una
// revisión final antes de enviar la sugerencia a moderación.
export default function RegisterPlacePage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ nombre: '', categoria: '', direccion: '', localidad: '', descripcion: '', contacto: '', latitud: '', longitud: '' });

  useEffect(() => {
    // Si venimos desde el mapa, reutilizamos la dirección ya resuelta para no
    // obligar a la persona a repetir la búsqueda.
    const searchParams = new URLSearchParams(window.location.search);
    const direccion = searchParams.get('direccion') || '';
    const latitud = searchParams.get('latitud') || '';
    const longitud = searchParams.get('longitud') || '';
    if (!direccion || !latitud || !longitud) return;
    setForm((current) => ({
      ...current,
      direccion,
      localidad: searchParams.get('localidad') || current.localidad,
      latitud,
      longitud
    }));
    setMessage('Dirección precargada desde el mapa. Completa la identidad del lugar para continuar.');
  }, []);

  const canContinue = useMemo(() => {
    // Cada paso valida únicamente los campos que la persona ya puede ver.
    if (step === 0) return form.nombre.trim().length >= 3 && form.categoria;
    if (step === 1) return form.direccion.trim().length >= 5 && form.latitud && form.longitud;
    if (step === 2) return form.descripcion.trim().length >= 10;
    return true;
  }, [step, form]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function validateAddress() {
    // Preview normaliza la nomenclatura y busca duplicados sin guardar nada.
    setLoading(true); setMessage('Validando dirección con Rolling / 4-72…');
    try {
      const response = await fetch('/api/site-suggestions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        // Las coordenadas sólo viajan si ya son números; vacías se omiten para
        // que Rolling / 4-72 las resuelvan a partir de la dirección.
        body: JSON.stringify({ ...form, ...coordinates(form), ciudad: 'Bogota', departamento: 'BOGOTA D.C.', divipola: '11001', descripcion: form.descripcion || 'Validación de ubicación para registro de local.' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No fue posible validar la dirección');
      setPreview(data);
      const suggestion = data.suggestion || {};
      if (!suggestion.latitud || !suggestion.longitud) throw new Error('No encontramos coordenadas precisas para esta dirección. Revisa la nomenclatura.');
      setForm((current) => ({
        ...current,
        direccion: suggestion.direccion || current.direccion,
        localidad: suggestion.localidad || current.localidad,
        latitud: String(suggestion.latitud),
        longitud: String(suggestion.longitud)
      }));
      setMessage(data.duplicates?.length ? 'Ubicación encontrada. Detectamos posibles duplicados para revisar.' : 'Dirección validada correctamente dentro de Bogotá.');
    } catch (error) {
      setPreview(null); setMessage(error.message);
    }
    setLoading(false);
  }

  async function submit() {
    // El lugar entra como sugerencia pendiente; moderación decide su publicación.
    setLoading(true); setMessage('Enviando local a moderación…');
    try {
      const response = await fetch('/api/site-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          ...form,
          ciudad: 'Bogota', departamento: 'BOGOTA D.C.', divipola: '11001',
          suggested_by: user?.username,
          ...coordinates(form)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar el local');
      setMessage('Local enviado correctamente. Quedó pendiente de moderación.');
      setTimeout(() => router.push('/app'), 700);
    } catch (error) { setMessage(error.message); }
    setLoading(false);
  }

  return (
    <main className="wizard-shell">
      <section className="wizard-hero">
        <span className="eyebrow">REGISTRO COMUNITARIO · BOGOTÁ</span>
        <h1>Agrega un lugar a Rolling</h1>
        <p>El registro se valida con la base propia de Rolling y, cuando hace falta, con 4-72. Por ahora sólo operamos dentro de Bogotá D.C.</p>
      </section>

      <section className="wizard-card glass-wizard">
        <div className="stepper">
          {steps.map((label, index) => (
            <div className={`stepper-item ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`} key={label}>
              <span>{index < step ? '✓' : index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {step === 0 && <>
            <div className="wizard-heading"><span>01</span><div><h2>¿Qué lugar estás registrando?</h2><p>Empecemos por su identidad principal.</p></div></div>
            <label>Nombre del local<input value={form.nombre} onChange={(e) => update('nombre', e.target.value)} placeholder="Ej. Café Aurora" /></label>
            <label>Categoría<select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}><option value="">Selecciona una categoría</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
          </>}

          {step === 1 && <>
            <div className="wizard-heading"><span>02</span><div><h2>Ubícalo en Bogotá</h2><p>Validamos la nomenclatura y evitamos publicar puntos incorrectos.</p></div></div>
            <label>Dirección<input value={form.direccion} onChange={(e) => { update('direccion', e.target.value); update('latitud', ''); update('longitud', ''); }} placeholder="Cra 7 # 72-41" /></label>
            <label>Localidad <span className="optional">opcional</span><input value={form.localidad} onChange={(e) => update('localidad', e.target.value)} placeholder="Chapinero" /></label>
            <button type="button" className="validate-button" onClick={validateAddress} disabled={loading || form.direccion.length < 5}>{loading ? 'Validando…' : 'Validar con 4-72'}</button>
            {form.latitud && <div className="verified-location"><strong>✓ Ubicación verificada</strong><span>{form.direccion}</span><small>{form.latitud}, {form.longitud}</small></div>}
            {preview?.duplicates?.length > 0 && <div className="duplicate-warning"><strong>Posibles duplicados</strong>{preview.duplicates.slice(0, 3).map((d) => <span key={d.id}>{d.nombre} · {d.distancia_metros} m</span>)}</div>}
          </>}

          {step === 2 && <>
            <div className="wizard-heading"><span>03</span><div><h2>Cuéntanos qué lo hace especial</h2><p>Esta información ayuda a moderadores y futuros visitantes.</p></div></div>
            <label>Descripción<textarea rows="6" value={form.descripcion} onChange={(e) => update('descripcion', e.target.value)} placeholder="¿Qué ofrece, qué ambiente tiene y por qué lo recomendarías?" /></label>
            <label>Contacto o sitio web <span className="optional">opcional</span><input value={form.contacto} onChange={(e) => update('contacto', e.target.value)} placeholder="https://... o teléfono" /></label>
          </>}

          {step === 3 && <>
            <div className="wizard-heading"><span>04</span><div><h2>Revisa antes de enviar</h2><p>El local no se publica inmediatamente: entra a moderación.</p></div></div>
            <div className="review-sheet">
              <div><small>LOCAL</small><strong>{form.nombre}</strong><span>{form.categoria}</span></div>
              <div><small>UBICACIÓN</small><strong>{form.direccion}</strong><span>{form.localidad || 'Bogotá D.C.'}</span></div>
              <div><small>DESCRIPCIÓN</small><p>{form.descripcion}</p></div>
            </div>
          </>}
        </div>

        {message && <div className="wizard-message">{message}</div>}
        <footer className="wizard-footer">
          <button type="button" className="soft-step" disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)}>Atrás</button>
          {step < 3 ? <button type="button" className="next-step" disabled={!canContinue || loading} onClick={() => setStep((s) => s + 1)}>Continuar</button> : <button type="button" className="next-step" disabled={loading} onClick={submit}>{loading ? 'Enviando…' : 'Enviar a moderación'}</button>}
        </footer>
      </section>

      <style jsx>{`
        .wizard-shell{min-height:calc(100vh - 65px);padding:44px 20px 70px;background:#f7f5ef;}.wizard-hero{max-width:790px;margin:0 auto 24px;text-align:center}.wizard-hero h1{font-size:var(--fs-display);margin:7px 0 12px;letter-spacing:-.01em}.wizard-hero p{max-width:650px;margin:0 auto;color:#66736d;line-height:1.6}.glass-wizard{max-width:820px;margin:auto;background:#fff;border:1px solid #deddd5;box-shadow:0 1px 3px rgba(0,0,0,.08);border-radius:12px;overflow:hidden}.stepper{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:24px 28px 18px;border-bottom:1px solid rgba(25,36,31,.16)}.stepper-item{display:grid;justify-items:center;gap:7px;position:relative;color:#9ba39f}.stepper-item span{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#ecebe5;box-shadow:0 1px 2px rgba(0,0,0,.08);font-weight:900}.stepper-item small{font-size:var(--fs-comment);font-weight:800}.stepper-item.active span{background:#225e49;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}.stepper-item.active small{color:#225e49}.stepper-item.done span{background:#dcfce7;color:#15803d}.wizard-body{padding:34px 42px 28px;display:grid;gap:18px;min-height:400px}.wizard-heading{display:flex;gap:14px;align-items:flex-start;margin-bottom:5px}.wizard-heading>span{font-size:var(--fs-info);font-weight:900;letter-spacing:.1em;color:#225e49;border:1px solid rgba(34,94,73,.2);background:rgba(238,242,255,.7);padding:7px 8px;border-radius:9px}.wizard-heading h2{margin:0 0 5px;font-size:var(--fs-title)}.wizard-heading p{margin:0;color:#66736d}.wizard-body label{display:grid;gap:7px;color:#334039;font-size:var(--fs-info);font-weight:800}.wizard-body input,.wizard-body select,.wizard-body textarea{border:0;outline:none;border-radius:15px;background:#f7f6f2;padding:13px 15px;box-shadow:0 1px 2px rgba(0,0,0,.08);color:#19241f;resize:vertical}.optional{font-weight:500;color:#9ba39f}.validate-button{justify-self:start;border-radius:14px;padding:12px 16px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08);color:#225e49;font-weight:900}.validate-button:disabled{opacity:.45}.verified-location,.duplicate-warning{display:grid;gap:4px;border-radius:16px;padding:13px 15px;background:rgba(220,252,231,.7);border:1px solid rgba(34,197,94,.16);color:#166534}.verified-location span,.duplicate-warning span{font-size:var(--fs-info)}.verified-location small{opacity:.7}.duplicate-warning{background:rgba(254,243,199,.7);border-color:rgba(245,158,11,.2);color:#92400e}.review-sheet{display:grid;gap:12px}.review-sheet>div{display:grid;gap:4px;padding:15px 17px;border-radius:17px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}.review-sheet small{font-size:var(--fs-comment);letter-spacing:.12em;color:#225e49;font-weight:900}.review-sheet span,.review-sheet p{color:#66736d;margin:0}.wizard-message{margin:0 42px 18px;border-radius:13px;padding:11px 14px;background:rgba(238,242,255,.75);color:#225e49;font-size:var(--fs-info);font-weight:700}.wizard-footer{display:flex;justify-content:space-between;padding:20px 42px 28px;border-top:1px solid rgba(25,36,31,.14)}.soft-step,.next-step{padding:12px 20px;border-radius:14px;font-weight:900}.soft-step{background:#ecebe5;box-shadow:0 1px 2px rgba(0,0,0,.08)}.next-step{background:#225e49;color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:650px){.wizard-shell{padding:25px 10px}.stepper{padding:18px 10px}.stepper-item small{display:none}.wizard-body{padding:25px 20px}.wizard-footer{padding:18px 20px}.wizard-message{margin:0 20px 15px}}
      `}</style>
    </main>
  );
}

// Convierte latitud/longitud del formulario (texto) a números. Si están vacías
// o no son válidas, no se envían.
function coordinates(form) {
  const latitud = form.latitud === '' ? NaN : Number(form.latitud);
  const longitud = form.longitud === '' ? NaN : Number(form.longitud);
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return { latitud: undefined, longitud: undefined };
  return { latitud, longitud };
}
