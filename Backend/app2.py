# import cv2
# import os
# import numpy as np
# from PIL import Image
# from deepface import DeepFace
# from pymongo import MongoClient

# # Initialize MongoDB
# client = MongoClient("mongodb+srv://durgeshborole:u6Ihi1GAKF84YIP1@system.8xuulfp.mongodb.net/library?retryWrites=true&w=majority&appName=System")
# db = client["face_db"]
# users_col = db["users"]

# # Load all face images from local folder
# def load_faces_from_folder(folder_path="faces"):
#     faces = {}
#     for filename in os.listdir(folder_path):
#         if filename.endswith(".jpg") or filename.endswith(".png"):
#             barcode = filename.split(".")[0]
#             img_path = os.path.join(folder_path, filename)
#             img = np.array(Image.open(img_path).convert("RGB"))
#             faces[barcode] = img
#     return faces

# # Fetch name from MongoDB using barcode
# def get_name_from_barcode(barcode):
#     user = users_col.find_one({"barcode": barcode})
#     return user["name"] if user else None

# # Live face verification
# def verify_live_face(known_faces):
#     cap = cv2.VideoCapture(0)
#     print("[INFO] Starting webcam...")

#     while True:
#         ret, frame = cap.read()
#         if not ret:
#             break

#         verified = False
#         for barcode, db_img in known_faces.items():
#             try:
#                 result = DeepFace.verify(frame, db_img, enforce_detection=False, model_name='VGG-Face')
#                 if result["verified"]:
#                     name = get_name_from_barcode(barcode) or "Unknown"
#                     cv2.putText(frame, f"Verified: {name}", (50, 50),
#                                 cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
#                     print(f"[SUCCESS] Match found for barcode: {barcode}, Name: {name}")
#                     verified = True
#                     break
#             except Exception as e:
#                 print(f"[ERROR] while comparing with {barcode}.jpg:", e)

#         if not verified:
#             cv2.putText(frame, "No Match Found", (50, 50),
#                         cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

#         cv2.imshow("Face Verification", frame)

#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break

#     cap.release()
#     cv2.destroyAllWindows()

# if __name__ == "__main__":
#     print("[INFO] Loading faces from local folder...")
#     known_faces = load_faces_from_folder("faces")
#     print(f"[INFO] Loaded {len(known_faces)} face(s)")
#     verify_live_face(known_faces)


from flask import Flask, request, jsonify
from deepface import DeepFace
from pymongo import MongoClient
from PIL import Image
import numpy as np
import os
import base64
import io

app = Flask(__name__)

# MongoDB Setup
client = MongoClient("mongodb+srv://durgeshborole:u6Ihi1GAKF84YIP1@system.8xuulfp.mongodb.net/library?retryWrites=true&w=majority&appName=System")
db = client["face_db"]
users_col = db["users"]

# Load known face images (barcode.jpg)
def load_known_faces(folder="faces"):
    known_faces = {}
    for file in os.listdir(folder):
        if file.endswith(".jpg") or file.endswith(".png"):
            barcode = file.split(".")[0]
            img_path = os.path.join(folder, file)
            img = np.array(Image.open(img_path).convert("RGB"))
            known_faces[barcode] = img
    return known_faces

def get_name_from_barcode(barcode):
    user = users_col.find_one({"barcode": barcode})
    return user["name"] if user else None

@app.route("/verify-face", methods=["POST"])
def verify_face():
    try:
        data = request.get_json()
        image_data = data["image"].split(",")[1]  # remove base64 header
        img_bytes = base64.b64decode(image_data)
        img = np.array(Image.open(io.BytesIO(img_bytes)).convert("RGB"))

        known_faces = load_known_faces()

        for barcode, stored_img in known_faces.items():
            result = DeepFace.verify(img, stored_img, model_name="Facenet", enforce_detection=False)
            if result["verified"]:
                name = get_name_from_barcode(barcode) or "Unknown"
                return jsonify({"verified": True, "barcode": barcode, "name": name})

        return jsonify({"verified": False})
    
    except Exception as e:
        return jsonify({"error": str(e), "verified": False})

if __name__ == "__main__":
    app.run(debug=True,port=5001)
