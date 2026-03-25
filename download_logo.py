import requests
import os

url = "https://scontent.fdac20-1.fna.fbcdn.net/v/t39.30808-6/657582724_26564440456515340_6728634986172869669_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=1sM8UOnxV8kQ7kNvwGgq3Nw&_nc_oc=Adoo0jW6TUmIiseW1WNTo4rEvUpeeuehIxmbo9JIZW6GqcES7iVj9SONJYG2qjcD4ks&_nc_zt=23&_nc_ht=scontent.fdac20-1.fna&_nc_gid=k1J17uXu_8Kh1AoC1PhrQA&_nc_ss=7a32e&oh=00_AfzlVKLzrcKb7124omAFEwXkiaCAhBZM30--SjibVnz-Kw&oe=69C83507"
os.makedirs('icons', exist_ok=True)

try:
    print(f"Downloading original image from FB...")
    r = requests.get(url, stream=True)
    if r.status_code == 200:
        with open('icons/logo_new.png', 'wb') as f:
            f.write(r.content)
        print("Done. Saved to icons/logo_new.png")
    else:
        print(f"Failed to download: Status {r.status_code}")
except Exception as e:
    print(f"Error: {e}")
