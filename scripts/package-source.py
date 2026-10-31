"""Package only source-controlled/unignored project files; never toolchains or credentials."""
import hashlib,json,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'dist';out.mkdir(exist_ok=True)
paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
selected=[]
for name in sorted(set(filter(None,paths))):
 p=root/name
 if not p.is_file() or p.is_symlink():continue
 if any(part in {'.git','node_modules','android','ios','dist','keys'} for part in p.relative_to(root).parts):continue
 if p.name.startswith('.env') or p.suffix in {'.keystore','.jks','.pem','.p12'}:continue
 selected.append(p)
archive=out/'hermione-android-poc-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in selected:z.write(p,'hermione-android-poc/'+str(p.relative_to(root)))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'hermione-android-poc/POC_README.md' in z.namelist()
 assert not any('/node_modules/' in n or '/.git/' in n for n in z.namelist())
print(json.dumps({'archive':str(archive),'source_files':len(selected),'bytes':archive.stat().st_size,'sha256':hashlib.file_digest(archive.open('rb'),'sha256').hexdigest()},indent=2))
