"""
==============================================================================
CASE ROUTES — /api/cases
==============================================================================
"""

import uuid
from flask import Blueprint, request, jsonify, g
from db import get_db
from auth_utils import token_required

cases_bp = Blueprint('cases', __name__, url_prefix='/api/cases')


def row_to_dict(row):
    return dict(row)


@cases_bp.route('', methods=['GET'])
@token_required
def list_cases():
    db = get_db()
    rows = db.execute('SELECT * FROM cases ORDER BY date_created DESC').fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@cases_bp.route('', methods=['POST'])
@token_required
def create_case():
    data = request.get_json(silent=True) or {}
    case_number = data.get('caseNumber')
    lead_investigator = data.get('leadInvestigator')

    if not case_number or not lead_investigator:
        return jsonify({'error': 'caseNumber and leadInvestigator are required'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM cases WHERE case_number = ?', (case_number,)).fetchone()
    if existing:
        return jsonify({'error': 'a case with this case number already exists'}), 409

    case_id = str(uuid.uuid4())
    db.execute('''
        INSERT INTO cases (id, case_number, lead_investigator, badge_id, agency, suspect, incident_date, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        case_id, case_number, lead_investigator,
        data.get('badgeId'), data.get('agency'), data.get('suspect'),
        data.get('incidentDate'), data.get('notes'), g.current_user['id']
    ))
    db.commit()

    created = db.execute('SELECT * FROM cases WHERE id = ?', (case_id,)).fetchone()
    return jsonify(row_to_dict(created)), 201


@cases_bp.route('/<case_id>', methods=['GET'])
@token_required
def get_case(case_id):
    db = get_db()
    row = db.execute('SELECT * FROM cases WHERE id = ?', (case_id,)).fetchone()
    if not row:
        return jsonify({'error': 'case not found'}), 404
    return jsonify(row_to_dict(row))
