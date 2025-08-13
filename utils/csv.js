export function exportToCsv(filename, rows, headerOrder, metaComment) {
  if (!rows || !rows.length) return;
  const keys = headerOrder || Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [];
  if (metaComment) lines.push(`# ${metaComment.replace(/\n/g,' ')}\n`);
  lines.push(keys.join(','));
  for (const r of rows) lines.push(keys.map(k=>esc(r[k])).join(','));
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display='none';
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 1000);
}
