from PIL import Image
import sys

def remove_white_bg(img_path):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # threshold for white
    for item in datas:
        # if white or very close to white, make transparent
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(img_path, "PNG")
    print(f"Removed white background from {img_path}")

if __name__ == "__main__":
    remove_white_bg(r"d:\Samba-Cafe\samba-cafe\public\logo.png")
