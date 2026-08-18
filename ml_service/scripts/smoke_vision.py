"""One-off smoke test for /vision/detect-damage."""
import io
import json
import urllib.request
import uuid

from PIL import Image

img = Image.new("RGB", (320, 240), (100, 150, 200))
buf = io.BytesIO()
img.save(buf, format="JPEG")
body = buf.getvalue()

boundary = uuid.uuid4().hex
part = (
    f'--{boundary}\r\n'
    f'Content-Disposition: form-data; name="image"; filename="t.jpg"\r\n'
    f'Content-Type: image/jpeg\r\n\r\n'
).encode()
tail = f"\r\n--{boundary}--\r\n".encode()
data = part + body + tail

req = urllib.request.Request(
    "http://localhost:8001/vision/detect-damage",
    data=data,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
)
print(json.dumps(json.loads(urllib.request.urlopen(req).read()), indent=2))
