"""Verify protected source contracts and generated art against the tested build."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/resident-stories-v1'
ART = ROOT / 'assets/resident-stories-v1'
BUILD = ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'dist')
REPORT_PATH = OUT / (sys.argv[2] if len(sys.argv) > 2 else 'integrity-report.json')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

baseline = json.loads((OUT / 'baseline.json').read_text(encoding='utf-8'))
protected = []
for name, digest in baseline['files'].items():
    if name == 'src/delivery/DeliveryChapters.ts':
        continue  # The five original definitions have independent value-digest regressions.
    protected.append({'path': name, 'before': digest, 'after': sha(ROOT / name),
                      'unchanged': sha(ROOT / name) == digest})

build_hashes = {}
for file in BUILD.rglob('*'):
    if file.is_file():
        build_hashes.setdefault(sha(file), []).append(file.relative_to(BUILD).as_posix())
processing = json.loads((ART / 'processing.json').read_text(encoding='utf-8'))
images = []
for record in processing['records']:
    source = ART / record['source']
    output = ART / record['output']
    images.append({'source': record['source'], 'runtime': record['output'],
                   'sourceUnchanged': sha(source) == record['sourceSha256'],
                   'runtimeMatchesProcessing': sha(output) == record['outputSha256'],
                   'builtFiles': build_hashes.get(sha(output), [])})

provenance = []
for filename in ['generation-core.json', 'generation-ui-kits.json',
                 'generation-memories.json', 'generation-endings.json']:
    document = json.loads((ART / filename).read_text(encoding='utf-8'))
    for record in document['records']:
        if filename == 'generation-core.json':
            original, local = Path(record['output']), ART / record['source']
        elif filename == 'generation-ui-kits.json':
            original, local = Path(record['source_path']), ROOT / record['project_source']
        else:
            original, local = Path(record['original_path']), ART / record['source_path']
        provenance.append({'record': filename, 'source': local.relative_to(ROOT).as_posix(),
                           'originalExists': original.is_file(),
                           'copiedByteIdentically': original.is_file() and sha(original) == sha(local)})

revision = ART / 'revision-menu-style'
for filename in ['generation-destinations.json', 'generation-memories.json', 'generation-endings.json', 'generation-middles.json']:
    document = json.loads((revision / filename).read_text(encoding='utf-8'))
    for record in document['records']:
        if 'project_source' in record:
            original, local = Path(record['source_path']), ROOT / record['project_source']
        else:
            original, local = Path(record['original_path']), revision / record['source_path']
        provenance.append({'record': 'revision-menu-style/' + filename, 'source': local.relative_to(ROOT).as_posix(),
                           'originalExists': original.is_file(),
                           'copiedByteIdentically': original.is_file() and sha(original) == sha(local)})

bundles = [{'path': p.relative_to(BUILD).as_posix(), 'sha256': sha(p)}
           for p in sorted((BUILD / 'assets').glob('main-*.js'))]
passed = (all(r['unchanged'] for r in protected)
          and len(images) == 46 and all(r['sourceUnchanged'] and r['runtimeMatchesProcessing'] and r['builtFiles'] for r in images)
          and len(provenance) == 44 and all(r['copiedByteIdentically'] for r in provenance))
report = {'passed': passed, 'build': BUILD.relative_to(ROOT).as_posix(), 'bundles': bundles,
          'protectedFiles': protected, 'runtimeAssets': images, 'generatedOriginals': provenance,
          'originalChapterContent': 'Five original chapter value digests checked in ResidentRoutes.test.ts',
          'phoneDeviceTest': 'NOT_RUN', 'apkBuild': 'NOT_REQUESTED'}
REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': passed, 'protected': len(protected), 'runtimeAssets': len(images),
                  'generatedOriginals': len(provenance), 'bundles': bundles}, ensure_ascii=False))
if not passed:
    raise SystemExit(1)
