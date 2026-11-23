"""Flatten the rendered icon/splash to RGB (no alpha) and copy them into the
iOS asset catalog. Run by tools/store/render-icons.mjs."""
import json, os, shutil
from PIL import Image

def flat(src, dst):
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGB', im.size, (7, 13, 18))
    bg.paste(im, mask=im.split()[3])
    bg.save(dst, 'PNG', optimize=True)
    out = Image.open(dst)
    assert out.mode == 'RGB', out.mode
    print(dst, out.size, out.mode)

flat('assets-src/app-icon-1024.png', 'assets-src/app-icon-1024.png')
flat('assets-src/splash-2732.png', 'assets-src/splash-2732.png')

icon_dir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset'
for f in os.listdir(icon_dir):
    if f.endswith('.png'):
        os.remove(os.path.join(icon_dir, f))
shutil.copy('assets-src/app-icon-1024.png', os.path.join(icon_dir, 'AppIcon-1024.png'))
json.dump({
    'images': [{'filename': 'AppIcon-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}],
    'info': {'author': 'xcode', 'version': 1},
}, open(os.path.join(icon_dir, 'Contents.json'), 'w'), indent=2)

splash_dir = 'ios/App/App/Assets.xcassets/Splash.imageset'
for name in ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']:
    shutil.copy('assets-src/splash-2732.png', os.path.join(splash_dir, name))
