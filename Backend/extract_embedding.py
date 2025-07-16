# extract_embedding.py
import sys
import json
import base64
import numpy as np
import cv2
import face_recognition

def get_embedding(base64_img):
    image_data = base64.b64decode(base64_img.split(",")[1])
    nparr = np.frombuffer(image_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    faces = face_recognition.face_encodings(img)
    if not faces:
        return None
    return faces[0].tolist()

if __name__ == "__main__":
    try:
        img_base64 = sys.argv[1]
        embedding = get_embedding(img_base64)
        if embedding:
            print(json.dumps(embedding))
        else:
            print("[]")
    except Exception as e:
        print("[]")
