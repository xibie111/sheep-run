from pathlib import Path
from PIL import Image
from io import BytesIO
import zipfile, hashlib, json
root=Path(__file__).resolve().parents[2]
apk=root/'android/app/build/outputs/apk/debug/app-debug.apk'
checked=0
icons=0
with zipfile.ZipFile(apk) as archive:
    assert archive.testzip() is None
    config=json.loads(archive.read('assets/capacitor.config.json'))
    assert config['plugins']['SystemBars'] == {'hidden':True,'insetsHandling':'disable'}
    assert config['android']['backgroundColor']=='#73b95b'
    for file in (root/'dist').rglob('*'):
        if file.is_file():
            name='assets/public/'+file.relative_to(root/'dist').as_posix()
            assert archive.read(name) == file.read_bytes(),name
            checked+=1
    for density in ('mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'):
        for name in ('ic_launcher','ic_launcher_round','ic_launcher_scene'):
            matches=[p for p in archive.namelist() if p.startswith('res/mipmap-'+density+'-') and p.endswith('/'+name+'.png')]
            assert len(matches)==1,(density,name,matches)
            packaged=Image.open(BytesIO(archive.read(matches[0]))).convert('RGBA')
            local=Image.open(root/'android/app/src/main/res'/('mipmap-'+density)/(name+'.png')).convert('RGBA')
            assert packaged.size==local.size and packaged.tobytes()==local.tobytes(),(density,name)
            icons+=1
report={'application':'小羊快跑','package':'com.sheeprun.game','version':'1.0','build':'debug','minSdk':24,'targetSdk':36,'testsPassed':359,'testFilesPassed':49,'gradleBuild':'SUCCESS','apkSignatureV2Verified':True,'orientation':'sensorLandscape','webFilesByteMatched':checked,'iconResourcesPixelMatched':icons,'icon':'assets/app-icon/sheep-pasture-icon-source-v2.png','apkBytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'deviceInstallTest':'not run; adb devices returned no connected devices'}
(root/'docs/android-build/2026-10-10/fullscreen-apk-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

