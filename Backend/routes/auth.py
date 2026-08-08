"""
==============================================================================
AUTH ROUTES — /api/auth/register, /api/auth/login
==============================================================================
"""

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db
from auth_utils import sign_token

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')
    display_name = data.get('displayName')

    if not username or not password:
        return jsonify({'error': 'username and password are required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'password must be at least 8 characters'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        return jsonify({'error': 'username already taken'}), 409

    # werkzeug's generate_password_hash uses a salted hash (scrypt by default)
    # — same idea as bcrypt, no extra native dependency needed.
    password_hash = generate_password_hash(password)

    cursor = db.execute(
        'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
        (username, password_hash, display_name or username)
    )
    db.commit()

    user = db.execute('SELECT * FROM users WHERE id = ?', (cursor.lastrowid,)).fetchone()
    token = sign_token(user)

    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'username': user['username'], 'displayName': user['display_name'], 'role': user['role']}
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'username and password are required'}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()

    # Same error message for "no such user" and "wrong password" so we
    # don't leak which usernames exist in the system.
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'invalid username or password'}), 401

    token = sign_token(user)
    return jsonify({
        'token': token,
        'user': {'id': user['id'], 'username': user['username'], 'displayName': user['display_name'], 'role': user['role']}
    })
