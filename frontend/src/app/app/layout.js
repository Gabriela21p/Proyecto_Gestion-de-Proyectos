'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AppLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };
  const canModerate = user && ['admin', 'moderator'].includes(user.role);

  if (loading || !user) {
    return (
      <main className="session-gate" aria-live="polite">
        <div className="session-gate__panel">
          <strong>Rolling Bogotá</strong>
          <span>Validando tu sesión...</span>
        </div>
      </main>
    );
  }

  const navItem = (href, label) => {
    const active = href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
    return <Link className={active ? 'rolling-nav__link rolling-nav__link--active' : 'rolling-nav__link'} href={href}>{label}</Link>;
  };

  return (
    <>
      <header className="rolling-header">
        <div className="rolling-header__glass">
          <Link className="rolling-brand" href="/app">
            <span className="rolling-brand__orb">R</span>
            <span><strong>Rolling</strong><small>Bogotá D.C.</small></span>
          </Link>

          <nav className="rolling-nav" aria-label="Navegación principal">
            {navItem('/app', 'Explorar')}
            {navItem('/app/registrar', 'Registrar local')}
            {canModerate && navItem('/app/admin', 'Moderación')}
          </nav>

          <div className="rolling-user">
            <span className="rolling-user__stats"><b>{user.reputation}</b><small>reputación</small></span>
            <span className="rolling-user__identity"><strong>{user.username}</strong><small>{user.role}</small></span>
            <button className="rolling-logout" onClick={handleLogout} aria-label="Cerrar sesión">↗</button>
          </div>
        </div>
      </header>
      {children}

      <style jsx>{`
        .rolling-header{position:sticky;top:0;z-index:1000;padding:9px 12px;background:linear-gradient(180deg,rgba(232,239,238,.94),rgba(232,239,238,.58));backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        .rolling-header__glass{max-width:1460px;margin:auto;min-height:58px;padding:8px 10px 8px 12px;border-radius:21px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:20px;border:1px solid rgba(255,255,255,.82);background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(255,255,255,.5));box-shadow:0 14px 36px rgba(44,55,70,.12),inset 0 1px 0 rgba(255,255,255,.98);backdrop-filter:blur(24px) saturate(145%);-webkit-backdrop-filter:blur(24px) saturate(145%)}
        .rolling-brand{display:flex;align-items:center;gap:9px;color:#172033}.rolling-brand__orb{display:grid;width:39px;height:39px;place-items:center;border-radius:14px;color:#fff;background:linear-gradient(135deg,#4f46e5,#8b5cf6);box-shadow:0 9px 20px rgba(79,70,229,.26),inset 0 1px 0 rgba(255,255,255,.35);font-weight:950}.rolling-brand>span:last-child{display:grid;line-height:1.05}.rolling-brand strong{font-size:.95rem;letter-spacing:-.02em}.rolling-brand small{margin-top:3px;color:#7c8798;font-size:.61rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
        .rolling-nav{display:flex;justify-content:center;gap:7px}.rolling-nav :global(.rolling-nav__link){padding:9px 13px;border-radius:13px;color:#516073;font-size:.78rem;font-weight:850;transition:.18s}.rolling-nav :global(.rolling-nav__link:hover){color:#4f46e5;background:rgba(255,255,255,.65);box-shadow:5px 5px 12px rgba(71,85,105,.1),-5px -5px 12px rgba(255,255,255,.82)}.rolling-nav :global(.rolling-nav__link--active){color:#4f46e5;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(238,242,255,.66));box-shadow:inset 0 0 0 1px rgba(99,102,241,.14),5px 5px 12px rgba(71,85,105,.08),-5px -5px 12px rgba(255,255,255,.8)}
        .rolling-user{display:flex;align-items:center;gap:10px}.rolling-user__stats,.rolling-user__identity{display:grid;line-height:1.05}.rolling-user__stats{text-align:right;padding-right:10px;border-right:1px solid rgba(148,163,184,.2)}.rolling-user__stats b{font-size:.82rem;color:#4f46e5}.rolling-user small{margin-top:3px;color:#8b96a7;font-size:.58rem;text-transform:uppercase;letter-spacing:.06em}.rolling-user__identity strong{font-size:.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis}.rolling-logout{width:39px;height:39px;border:0;border-radius:13px;background:#edf2f1;box-shadow:5px 5px 12px rgba(71,85,105,.13),-5px -5px 12px rgba(255,255,255,.92);font-size:1rem;font-weight:900;color:#64748b}.rolling-logout:active{box-shadow:inset 4px 4px 9px rgba(71,85,105,.12),inset -4px -4px 9px #fff}
        @media(max-width:800px){.rolling-header{padding:6px}.rolling-header__glass{grid-template-columns:auto 1fr;gap:8px;border-radius:18px}.rolling-nav{grid-column:1/-1;order:3;justify-content:flex-start;overflow:auto;padding-top:3px}.rolling-user__stats,.rolling-user__identity{display:none}.rolling-user{justify-self:end}.rolling-nav :global(.rolling-nav__link){white-space:nowrap;padding:8px 11px}}
      `}</style>
    </>
  );
}
