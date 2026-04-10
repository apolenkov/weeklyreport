export default function HomePage() {
  return (
    <main>
      <h1>CustomReport</h1>
      <p>Weekly status report system for Development department.</p>
      <nav>
        <ul>
          <li><a href="/lead/report">Lead: Fill report section</a></li>
          <li><a href="/head/dashboard">Head: Review dashboard</a></li>
          <li><a href="/head/report">Head: Assembled report</a></li>
          <li><a href="/reports/history">Report history</a></li>
        </ul>
      </nav>
    </main>
  );
}
