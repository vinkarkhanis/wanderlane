import xml.etree.ElementTree as ET
import json,hashlib,gzip,datetime
from pathlib import Path
objects={}
for p in sorted(Path('data-sources/pune/raw').glob('quadrant-*.osm')):
 for e in ET.parse(p).getroot():
  if e.tag not in ('node','way','relation'): continue
  d={'type':e.tag,'id':int(e.attrib['id'])}
  if e.tag=='node': d.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
  if e.tag=='way': d['nodes']=[int(n.attrib['ref']) for n in e.findall('nd')]
  if e.tag=='relation': d['members']=[{'type':m.attrib['type'],'ref':int(m.attrib['ref']),'role':m.attrib['role']} for m in e.findall('member')]
  tags={t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
  if tags:d['tags']=tags
  objects[(e.tag,d['id'])]=d
content=json.dumps({'version':0.6,'generator':'WANDERLANE offline OSM API XML conversion','elements':[objects[k] for k in sorted(objects)]},separators=(',',':'),ensure_ascii=False).encode('utf-8')
Path('data-sources/pune/raw/osm.json').write_bytes(content)
with gzip.GzipFile('data-sources/pune/osm-source.json.gz','wb',mtime=0) as f:f.write(content)
meta={'source':'OpenStreetMap API 0.6 map export','url':'https://api.openstreetmap.org/api/0.6/map','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'licence':'ODbL-1.0','copyright':'https://www.openstreetmap.org/copyright','sha256':hashlib.sha256(content).hexdigest(),'bounds':{'west':73.772,'south':18.534,'east':73.810,'north':18.570},'queries':['https://api.openstreetmap.org/api/0.6/map?bbox='+s for s in ['73.772,18.534,73.791,18.552','73.791,18.534,73.810,18.552','73.772,18.552,73.791,18.570','73.791,18.552,73.810,18.570']],'preprocessing':'Four API exports deduplicated by element type/id, numeric node coordinates and tags retained, converted to Overpass-compatible JSON and gzip cached. Overpass query supplied as future equivalent, not source of this snapshot.','modifiedDatabaseDistributed':True}
Path('data-sources/pune/source-metadata.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
print(len(objects),len(content),meta['retrievedAt'])
