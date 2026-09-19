export default function Table({ columns, rows, empty = 'No records yet.' }) {
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={row.key ?? i}>{row.cells.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}</tbody></table></div>;
}
