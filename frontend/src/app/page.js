// Este código se ejecuta en el servidor de Next.js
async function getData() {
  const res = await fetch('http://localhost:5000/api/data', { cache: 'no-store' });
  if (!res.ok) throw new Error('Falló la carga de datos');
  return res.json();
}

export default async function Page() {
  const data = await getData();

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Proyecto Flask + Next.js</h1>
      <p>Mensaje desde el backend: <strong>{data.mensaje}</strong></p>
    </main>
  );
}