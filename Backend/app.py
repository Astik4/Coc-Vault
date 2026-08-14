"""
==============================================================================
CoC Vault Backend — Flask app entry point
==============================================================================
Run with: python app.py  (or flask run)
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

from db import init_db, close_db
from routes.auth import auth_bp
from routes.cases import cases_bp
from routes.evidence import evidence_bp

load_dotenv()

app = Flask(__name__)

# CORS_ORIGIN in .env can be a single origin or a comma-separated list.
# Defaults cover every way people commonly run the frontend locally:
# npx http-server (8080), VS Code "Live Server" (5500), plain 127.0.0.1
# variants, and 'null' (the Origin browsers send when a file is opened
# directly with file:// instead of through a server).
_default_origins = (
    'http://localhost:8080,http://127.0.0.1:8080,'
    'http://localhost:5500,http://127.0.0.1:5500,'
    'null'
)
cors_origins = [
    origin.strip()
    for origin in os.environ.get('CORS_ORIGIN', _default_origins).split(',')
    if origin.strip()
]

CORS(app, origins=cors_origins)

# Rate limiting — mainly to slow down brute-force login/register attempts.
limiter = Limiter(get_remote_address, app=app, default_limits=[])

app.register_blueprint(auth_bp)
app.register_blueprint(cases_bp)
app.register_blueprint(evidence_bp)

# Apply a stricter limit specifically to the auth blueprint's routes.
limiter.limit("20 per 15 minutes")(auth_bp)

app.teardown_appcontext(close_db)


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'not found'}), 404


@app.errorhandler(500)
def server_error(e):
    app.logger.exception(e)
    return jsonify({'error': 'internal server error'}), 500


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 4000))
    app.run(host='0.0.0.0', port=port, debug=True)
