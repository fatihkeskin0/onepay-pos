export default function AccessDeniedPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-title">Erişim engellendi</h1>
        <p className="login-sub">
          Bu IP adresinden panele erişim izni yok. Yöneticinizle iletişime geçin.
        </p>
      </div>
    </main>
  );
}
