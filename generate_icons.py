import os
from PIL import Image

def resize_icon(source_fn, size):
    img = Image.open(source_fn)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

source = 'icons/logo_new.png'
os.makedirs('icons', exist_ok=True)

# Generate the standard sizes
for s in [16, 32, 48, 128]:
    fn = f'icons/icon{s}.png'
    try:
        resize_icon(source, s).save(fn)
        print(f"Generated {fn} from rainbow source")
    except Exception as e:
        print(f"Failed {fn}: {e}")
