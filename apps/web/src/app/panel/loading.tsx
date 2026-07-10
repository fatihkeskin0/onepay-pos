export default function PanelLoading() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title dash-skeleton" style={{ width: "12rem", height: "1.5rem" }} />
          <div className="page-sub dash-skeleton" style={{ width: "18rem", height: "0.875rem", marginTop: "0.5rem" }} />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={6}>
                  <div className="dash-skeleton" style={{ height: "2rem" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
