from PIL import Image

def perfect_transparent_bg(img_path, original_path):
    img = Image.open(original_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        r, g, b, a = item
        dist_to_white = ((255-r)**2 + (255-g)**2 + (255-b)**2)**0.5
        
        if dist_to_white < 5:
            # Pure white -> transparent
            newData.append((255, 255, 255, 0))
        elif dist_to_white < 150 and abs(r-g) < 20 and abs(g-b) < 20 and abs(r-b) < 20:
            # It's a gray/whitish pixel (anti-aliasing halo)
            # Recover alpha assuming it was black anti-aliased on white
            avg = (r + g + b) / 3
            alpha = int(255 - avg)
            newData.append((0, 0, 0, alpha))
        else:
            # Keep original pixel
            newData.append(item)
            
    img.putdata(newData)
    img.save(img_path, "PNG")

if __name__ == "__main__":
    perfect_transparent_bg(
        r"d:\Samba-Cafe\samba-cafe\public\logo.png",
        r"C:\Users\Deandra\.gemini\antigravity-ide\brain\410ff234-23b5-4c18-ab25-3baa99a4d176\samba_cafe_general_icon_2_1788405848569.png"
    )
