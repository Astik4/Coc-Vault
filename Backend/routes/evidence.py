"""
==============================================================================
EVIDENCE ROUTES — /api/evidence
==============================================================================
Handles evidence logging, custody transfers, and chain-of-custody
verification. This is where the hash-chaining logic lives.
"""

import uuid
import datetime
from flask import Blueprint, request, jsonify, g
from db import get_db, compute_entry_hash, GENESIS_HASH
from auth_utils import token_required

evidence_bp = Blueprint('evidence', __name__, url_prefix='/api/evidence')


def now_iso():
    return datetime.datetime.utcnow().isoformat() + 'Z'


def attach_custody_history(db, evidence_row):
    """Fetches the full ordered custody log for one evidence item and
    nests it into the evidence dict, matching what the frontend expects."""
    history_rows = db.execute(
        'SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence ASC',
        (evidence_row['id'],)
    ).fetchall()

    result = dict(evidence_row)
    result['custodyHistory'] = [dict(h) for h in history_rows]
    return result


@evidence_bp.route('', methods=['GET'])
@token_required
def list_evidence():
    db = get_db()
    case_id = request.args.get('caseId')

    if case_id:
        rows = db.execute('SELECT * FROM evidence WHERE case_id = ?', (case_id,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM evidence').fetchall()

    return jsonify([attach_custody_history(db, r) for r in rows])


@evidence_bp.route('', methods=['POST'])
@token_required
def create_evidence():
    data = request.get_json(silent=True) or {}
    case_id = data.get('caseId')
    item_id = data.get('itemId')
    file_hash = data.get('fileHash')
    collected_by = data.get('collectedBy')

    if not case_id or not item_id or not file_hash or not collected_by:
        return jsonify({'error': 'caseId, itemId, collectedBy, and fileHash are required'}), 400

    db = get_db()
    case_row = db.execute('SELECT id FROM cases WHERE id = ?', (case_id,)).fetchone()
    if not case_row:
        return jsonify({'error': 'case not found'}), 404

    evidence_id = str(uuid.uuid4())

    try:
        db.execute('''
            INSERT INTO evidence (id, case_id, item_id, evidence_type, make_model, location_found, collected_by, file_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            evidence_id, case_id, item_id,
            data.get('evidenceType'), data.get('makeModel'),
            data.get('locationFound'), collected_by, file_hash
        ))

        # Genesis custody entry — the acquisition record, chained from GENESIS_HASH
        timestamp = now_iso()
        entry = {
            'evidenceId': evidence_id,
            'sequence': 1,
            'timestamp': timestamp,
            'releasedBy': collected_by,
            'receivedBy': collected_by,
            'location': data.get('locationFound') or '',
            'purpose': 'Initial acquisition and sealing of evidence package',
            'notes': 'Logged directly in CoC Vault at scene of recovery.'
        }
        entry_hash = compute_entry_hash(GENESIS_HASH, entry)

        db.execute('''
            INSERT INTO custody_log
                (evidence_id, sequence, timestamp, released_by, received_by, released_sig, received_sig, location, purpose, notes, prev_hash, entry_hash)
            VALUES (?, 1, ?, ?, ?, 'ACQUISITION', 'ACQUISITION', ?, ?, ?, ?, ?)
        ''', (
            evidence_id, timestamp, entry['releasedBy'], entry['receivedBy'],
            entry['location'], entry['purpose'], entry['notes'], GENESIS_HASH, entry_hash
        ))

        db.commit()
    except Exception:
        db.rollback()
        raise

    created = db.execute('SELECT * FROM evidence WHERE id = ?', (evidence_id,)).fetchone()
    return jsonify(attach_custody_history(db, created)), 201


@evidence_bp.route('/<evidence_id>/transfer', methods=['POST'])
@token_required
def transfer_evidence(evidence_id):
    data = request.get_json(silent=True) or {}
    released_by = data.get('releasedBy')
    received_by = data.get('receivedBy')

    if not released_by or not received_by:
        return jsonify({'error': 'releasedBy and receivedBy are required'}), 400

    db = get_db()
    evidence_row = db.execute('SELECT * FROM evidence WHERE id = ?', (evidence_id,)).fetchone()
    if not evidence_row:
        return jsonify({'error': 'evidence item not found'}), 404

    last_entry = db.execute(
        'SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence DESC LIMIT 1',
        (evidence_id,)
    ).fetchone()

    next_sequence = (last_entry['sequence'] if last_entry else 0) + 1
    prev_hash = last_entry['entry_hash'] if last_entry else GENESIS_HASH

    timestamp = now_iso()
    entry = {
        'evidenceId': evidence_id,
        'sequence': next_sequence,
        'timestamp': timestamp,
        'releasedBy': released_by,
        'receivedBy': received_by,
        'location': data.get('location') or '',
        'purpose': data.get('purpose') or '',
        'notes': data.get('notes') or ''
    }
    entry_hash = compute_entry_hash(prev_hash, entry)

    db.execute('''
        INSERT INTO custody_log
            (evidence_id, sequence, timestamp, released_by, received_by, released_sig, received_sig, location, purpose, notes, prev_hash, entry_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        evidence_id, next_sequence, timestamp, released_by, received_by,
        data.get('releasedSig'), data.get('receivedSig'),
        entry['location'], entry['purpose'], entry['notes'], prev_hash, entry_hash
    ))
    db.commit()

    updated = db.execute('SELECT * FROM evidence WHERE id = ?', (evidence_id,)).fetchone()
    return jsonify(attach_custody_history(db, updated)), 201


@evidence_bp.route('/<evidence_id>/verify-chain', methods=['GET'])
@token_required
def verify_chain(evidence_id):
    """Re-walks the custody log for one evidence item, recomputing every
    hash from scratch and comparing it to what's stored. If a row was
    edited directly in the database, the hashes stop matching from that
    point forward and we report exactly where the break is."""
    db = get_db()
    entries = db.execute(
        'SELECT * FROM custody_log WHERE evidence_id = ? ORDER BY sequence ASC',
        (evidence_id,)
    ).fetchall()

    if not entries:
        return jsonify({'error': 'no custody entries found for this evidence item'}), 404

    expected_prev_hash = GENESIS_HASH
    for row in entries:
        recomputed = compute_entry_hash(expected_prev_hash, {
            'evidenceId': row['evidence_id'],
            'sequence': row['sequence'],
            'timestamp': row['timestamp'],
            'releasedBy': row['released_by'],
            'receivedBy': row['received_by'],
            'location': row['location'],
            'purpose': row['purpose'],
            'notes': row['notes']
        })

        if row['prev_hash'] != expected_prev_hash or row['entry_hash'] != recomputed:
            return jsonify({
                'intact': False,
                'brokenAtSequence': row['sequence'],
                'message': f"Chain integrity broken at custody entry #{row['sequence']}. "
                           f"This entry does not match its expected hash — the log may have been altered."
            })
        expected_prev_hash = row['entry_hash']

    return jsonify({'intact': True, 'message': 'Custody chain verified — no tampering detected across all entries.'})
