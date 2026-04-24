# Extension Icons

This directory should contain the following PNG icon files for the browser extension:

- `icon-16.png` - 16x16px (toolbar icon, small)
- `icon-48.png` - 48x48px (extension management page)
- `icon-128.png` - 128x128px (installation dialog, Chrome Web Store)
- `icon-512.png` - 512x512px (high-resolution for app stores)

## Generating Icons

You can generate these from the existing `public/discrub.png` logo using an image editor or command-line tools:

### Using ImageMagick (if installed):
```bash
# From the project root
convert public/discrub.png -resize 16x16 public/icons/icon-16.png
convert public/discrub.png -resize 48x48 public/icons/icon-48.png
convert public/discrub.png -resize 128x128 public/icons/icon-128.png
convert public/discrub.png -resize 512x512 public/icons/icon-512.png
```

### Using Online Tools:
- https://www.iloveimg.com/resize-image
- https://imageresizer.com/

### Using Photoshop/GIMP:
1. Open `public/discrub.png`
2. Image > Scale Image
3. Set dimensions (maintaining aspect ratio)
4. Export as PNG to `public/icons/`

## Temporary Workaround

The build script will warn if icons are missing but will continue without them. The extension will use default browser icons until proper icons are added.
