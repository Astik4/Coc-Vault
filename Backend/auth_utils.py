"""
==============================================================================
AUTH UTILITIES — JWT issuing/verification and a @token_required decorator
==============================================================================
"""

import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me')
JWT_ALGORITHM = 'HS256'
TOKEN_EXPIRY_HOURS = 8


def sign_token(user):
    """user is a sqlite3.Row from the users table."""
    payload = {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'displayName': user['display_name'],
        'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def token_required(f):
    """Decorator for routes that require a valid Bearer token. On success,
    stashes the decoded payload on flask.g.current_user for the route to use."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header[7:] if auth_header.startswith('Bearer ') else None

        if not token:
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401

        try:
            g.current_user = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return wrapper
