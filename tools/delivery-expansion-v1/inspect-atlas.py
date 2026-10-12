from PIL import Image, ImageChops, ImageStat
from pathlib import Path
for p in Path('assets/delivery-expansion-v1/chapters/sources').glob('*backgrounds.png'):
    im=Image.open(p).convert('RGB')
    peaks=sorted([(sum(ImageStat.Stat(ImageChops.difference(im.crop((0,y,im.width,y+1)),im.crop((0,y-1,im.width,y)))).mean)/3,y)
                  for y in range(int(im.height*.25),int(im.height*.75))],reverse=True)[:12]
    print(p.name,im.size,peaks)
    for start,end in ((0,540),(540,1083),(1083,1672)):
        candidates=[]
        for y in range(start+200,end-40):
            row=list(im.crop((0,y,im.width,y+1)).getdata())
            count=sum(1 for r,g,b in row if r>155 and g>95 and r>g*1.10 and r>b*1.3)
            if count/im.width>.9:
                candidates.append(y)
        print('tan road rows',start,candidates[:12])
