from pathlib import Path
import json,zipfile
root=Path('dist').resolve()
files=json.loads(Path('dist-files.json').read_text(encoding='utf-8'))
with zipfile.ZipFile('wanderlane-pune.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for f in files:
  p=(root/f).resolve()
  if not p.is_relative_to(root):raise ValueError('Invalid archive path')
  z.write(p,f)
print('ZIP written with index.html at archive root')
