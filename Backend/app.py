from flask import Flask, request, jsonify
from pymongo import MongoClient
import base64
import numpy as np
import cv2
import face_recognition
from scipy.spatial.distance import cosine

client = MongoClient("mongodb+srv://durgeshborole:u6Ihi1GAKF84YIP1@system.8xuulfp.mongodb.net/library?retryWrites=true&w=majority&appName=System")
db = client["library"]
visitors = db["visitors"]

app = Flask(__name__)

@app.route('/recognize-face', methods=['POST'])
def recognize():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({ "result": "error", "message": "No image provided" }), 400

        base64_img = data['image']
        if "," in base64_img:
            base64_img = base64_img.split(",")[1]

        try:
            img_bytes = base64.b64decode(base64_img)
        except Exception:
            print("❌ Failed to decode base64.")
            return jsonify({ "result": "error", "message": "Invalid base64 image" }), 400

        img_np = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(img_np, cv2.IMREAD_COLOR)

        if frame is None:
            print("❌ OpenCV failed to decode the image (None returned)")
            return jsonify({ "result": "error", "message": "Image decoding failed" }), 400

        # Check for proper format (should be RGB)
        if frame.dtype != np.uint8 or len(frame.shape) != 3 or frame.shape[2] != 3:
            print(f"❌ Invalid image shape: {frame.shape}")
            return jsonify({ "result": "error", "message": "Unsupported image format" }), 400

        # Process face
        encodings = face_recognition.face_encodings(frame)
        if not encodings:
            print("⚠️ No face detected.")
            return jsonify({ "result": "no_face" }), 200

        input_enc = encodings[0]
        best_match = None
        best_score = 1.0

        for visitor in visitors.find({ "faceDescriptor": { "$exists": True } }):
            try:
                stored_enc = np.array(visitor["faceDescriptor"])
                sim = cosine(input_enc, stored_enc)
                if sim < best_score:
                    best_score = sim
                    best_match = visitor
            except Exception as match_err:
                print(f"⚠️ Error comparing face: {match_err}")

        if best_score < 0.45:
            return jsonify({ "result": "match", "barcode": best_match["barcode"] }), 200
        else:
            return jsonify({ "result": "unrecognized" }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({ "result": "error", "message": str(e) }), 500


    
@app.route('/health')
def health():
    return jsonify({ "status": "Python server is alive" })

if __name__ == "__main__":
    app.run(port=5001)

