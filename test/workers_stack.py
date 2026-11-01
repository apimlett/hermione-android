"""Synthetic durable child lifecycle behind the real feature bridge. No Hermes imports."""
import json
import os
import sqlite3
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['HERMES_BRIDGE_SRC']) / 'src'))
from hermes_bridge.app import Bridge
from hermes_bridge.config import Config
from hermes_bridge.server import make_handler

with tempfile.TemporaryDirectory() as tmp:
    home = Path(tmp)
    key = 'synthetic-workers-key-only'
    (home/'key').write_text(key)
    db = home/'state.db'
    with sqlite3.connect(db) as c:
        c.execute('CREATE TABLE async_delegations (delegation_id TEXT, parent_session_id TEXT, state TEXT, dispatched_at REAL, updated_at REAL, completed_at REAL, delivery_state TEXT, task_json TEXT, result_json TEXT)')
        c.execute('INSERT INTO async_delegations VALUES (?,?,?,?,?,?,?,?,?)', ('deleg_fixture', 'parent-session', 'running', 10, 10, None, 'pending', json.dumps({'goal': 'PRIVATE GOAL'}), None))
    db.chmod(0o600)
    cfg = Config('127.0.0.1', 0, 'http://localhost', home/'unused-token', home/'key', hermes_home=home, allowed_profiles=('default',), worker_observability=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(Bridge(cfg)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(json.dumps({'url': f'http://127.0.0.1:{server.server_address[1]}', 'key': key}), flush=True)
    for line in sys.stdin:
        if line.strip() == 'complete':
            with sqlite3.connect(db) as c:
                c.execute('UPDATE async_delegations SET state=?, updated_at=?, completed_at=?, result_json=?', ('completed', 20, 20, json.dumps({'task_index': 0, 'status': 'completed', 'summary': 'PRIVATE RESULT'})))
            print('completed', flush=True)
    server.shutdown()
    server.server_close()
