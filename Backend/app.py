"""
==============================================================================
CoC Vault Backend — Flask app entry point
==============================================================================
Run with: python app.py  (or flask run)
"""

import os
from flask import Flask, jsonify, request
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

# max_age lets the browser cache a successful CORS preflight (OPTIONS) for
# an hour instead of re-sending one before every single request — fewer
# preflights also means fewer requests that could ever hit the rate limit
# below.
CORS(app, origins=cors_origins, max_age=3600)

# Rate limiting — mainly to slow down brute-force login/register attempts.
limiter = Limiter(get_remote_address, app=app, default_limits=[])

app.register_blueprint(auth_bp)
app.register_blueprint(cases_bp)
app.register_blueprint(evidence_bp)

# Apply a stricter limit specifically to the auth blueprint's routes.
# exempt_when skips counting CORS preflight (OPTIONS) requests — those
# aren't real login/register attempts, and counting them meant a browser
# could trip the limit on preflights alone. Once that happened, the
# preflight itself started returning 429 with no success status, which
# browsers treat as a hard CORS failure — every subsequent request
# (login, register, even after waiting) would fail with a confusing
# "can't reach the backend" network error instead of a clear "too many
# attempts" message, until the whole window reset.
limiter.limit("20 per 15 minutes", exempt_when=lambda: request.method == "OPTIONS")(auth_bp)

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
