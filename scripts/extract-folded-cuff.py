"""Extract the inspected folded fabric component; retain its UVs and embedded textures."""
import collections
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/Models/sphygmomanometer_low_poly.glb'
OUTPUT = ROOT / 'assets/Models/cuffs/folded-cuff.glb'
raw = SOURCE.read_bytes()
assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 4)[0] == 2
json_size = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20 + json_size])
bin_start = 20 + json_size + 8
binary = raw[bin_start:]
primitive = gltf['meshes'][0]['primitives'][0]

def values(index):
    accessor = gltf['accessors'][index]
    view = gltf['bufferViews'][accessor['bufferView']]
    fmt = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}[accessor['componentType']]
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    size = struct.calcsize('<' + fmt * count)
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from('<' + fmt * count, binary, offset + i * view.get('byteStride', size)) for i in range(accessor['count'])]

positions = values(primitive['attributes']['POSITION'])
indices = [v[0] for v in values(primitive['indices'])]
parents = list(range(len(positions)))

def root(i):
    while parents[i] != i:
        parents[i] = parents[parents[i]]
        i = parents[i]
    return i

def union(a, b):
    parents[root(a)] = root(b)

# Weld only for connectivity discovery; retain original vertices and UV seams in output.
seen = {}
for i, position in enumerate(positions):
    key = tuple(round(v, 5) for v in position)
    if key in seen:
        union(i, seen[key])
    else:
        seen[key] = i
for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
    union(a, b)
    union(b, c)
groups = collections.defaultdict(list)
for i in range(len(positions)):
    groups[root(i)].append(i)
# Inspected fabric component: 466 seam-preserving vertices; not the bulb or hoses.
candidates = [ids for ids in groups.values() if len(ids) == 466]
assert len(candidates) == 1, 'Source topology changed: visually re-identify the folded cuff.'
selected = candidates[0]
low = [min(positions[i][k] for i in selected) for k in range(3)]
high = [max(positions[i][k] for i in selected) for k in range(3)]
assert -0.40 < low[0] < -0.39 and -1.00 < low[2] < -0.99, 'Unexpected component bounds'
remap = {old: new for new, old in enumerate(selected)}
triangles = [indices[i:i + 3] for i in range(0, len(indices), 3) if indices[i] in remap]
assert all(all(v in remap for v in tri) for tri in triangles)

out = {'asset': {'version': '2.0', 'generator': 'scripts/extract-folded-cuff.py'}, 'scene': 0,
       'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'folded-cuff', 'mesh': 0}],
       'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [],
       'materials': gltf['materials'], 'textures': gltf.get('textures', []), 'samplers': gltf.get('samplers', [])}
chunks = bytearray()

def view(payload, target=None):
    while len(chunks) % 4:
        chunks.append(0)
    descriptor = {'buffer': 0, 'byteOffset': len(chunks), 'byteLength': len(payload)}
    if target:
        descriptor['target'] = target
    out['bufferViews'].append(descriptor)
    chunks.extend(payload)
    return len(out['bufferViews']) - 1

attributes = {}
for semantic, index in primitive['attributes'].items():
    accessor = gltf['accessors'][index]
    source_values = values(index)
    data = [source_values[i] for i in selected]
    if semantic == 'POSITION':
        # Preserve source axis orientation; center X/Z and ground Y. Units are meters.
        data = [((v[0] - (low[0] + high[0]) / 2) * .11, (v[1] - low[1]) * .11,
                 (v[2] - (low[2] + high[2]) / 2) * .11) for v in data]
    payload = b''.join(struct.pack('<' + 'f' * len(v), *v) for v in data)
    entry = {'bufferView': view(payload, 34962), 'componentType': 5126, 'count': len(data), 'type': accessor['type']}
    if semantic == 'POSITION':
        entry['min'] = [min(v[k] for v in data) for k in range(3)]
        entry['max'] = [max(v[k] for v in data) for k in range(3)]
    attributes[semantic] = len(out['accessors'])
    out['accessors'].append(entry)
index_accessor = len(out['accessors'])
flat = [remap[v] for tri in triangles for v in tri]
out['accessors'].append({'bufferView': view(struct.pack('<' + 'H' * len(flat), *flat), 34963),
                         'componentType': 5123, 'count': len(flat), 'type': 'SCALAR'})
out['meshes'] = [{'name': 'folded-cuff-fabric', 'primitives': [{'attributes': attributes, 'indices': index_accessor, 'material': primitive['material']}]}]
out['images'] = []
for image in gltf.get('images', []):
    original_view = gltf['bufferViews'][image['bufferView']]
    offset = original_view.get('byteOffset', 0)
    out['images'].append({**image, 'bufferView': view(binary[offset:offset + original_view['byteLength']])})
out['buffers'] = [{'byteLength': len(chunks)}]
out['extras'] = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(raw).hexdigest(),
                 'representation': 'folded-storage-only', 'vertices': len(selected), 'triangles': len(triangles),
                 'units': 'meters', 'license': 'Inherits original model license; original provenance not provided in repository.'}
encoded = json.dumps(out, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
chunks += b'\0' * (-len(chunks) % 4)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(encoded) + 8 + len(chunks)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + struct.pack('<I4s', len(chunks), b'BIN\0') + chunks)
print(f'{OUTPUT.relative_to(ROOT)}: {len(selected)} vertices, {len(triangles)} triangles, {OUTPUT.stat().st_size} bytes')
