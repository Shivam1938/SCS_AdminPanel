export default function AdminLoading() {
  return <div aria-label="Loading admin data" aria-busy="true">
    <div className="page-heading"><div><div className="card" style={{ width: 190, height: 28 }} /><div className="card" style={{ width: 280, height: 14, marginTop: 10 }} /></div></div>
    <div className="stat-grid">{Array.from({ length: 6 }, (_, index) => <div className="card" key={index} style={{ height: 112 }} />)}</div>
    <div className="dashboard-grid"><div className="card" style={{ height: 300 }} /><div className="card" style={{ height: 300 }} /></div>
  </div>;
}
