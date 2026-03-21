import hmac
import logging
import os
import tempfile
from pathlib import Path

from flask import Flask, request, jsonify
from preprocessing_json import parse_docx_to_json

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10 MB (Flask-level guard)

MAX_FILE_SIZE = 10 * 1024 * 1024
API_KEY = os.environ.get('PARSE_API_KEY', '')

# Limit Pillow image decompression to prevent image bombs
try:
    from PIL import Image as _PILImage
    _PILImage.MAX_IMAGE_PIXELS = 25_000_000  # 25 megapixels max
except ImportError:
    pass

logger = logging.getLogger(__name__)


@app.before_request
def check_api_key():
    if request.endpoint == 'health':
        return
    key = request.headers.get('X-API-Key', '')
    if not API_KEY or not hmac.compare_digest(key, API_KEY):
        return jsonify({'error': 'Unauthorized'}), 401


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/parse-word', methods=['POST'])
def parse_word():
    file_bytes = request.get_data()
    if len(file_bytes) == 0:
        return jsonify({'error': 'Aucun fichier reçu'}), 400

    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.docx')
    try:
        with os.fdopen(tmp_fd, 'wb') as f:
            f.write(file_bytes)
        result = parse_docx_to_json(tmp_path)
        return jsonify(result)
    except Exception as e:
        logger.exception('Parse failed')  # Full traceback in Railway logs
        return jsonify({'error': 'Erreur lors du parsing du fichier'}), 500  # Generic message to client
    finally:
        Path(tmp_path).unlink(missing_ok=True)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
