"""
WebSocket smoke tests (unit — no DB needed for the handshake).

The real-time auction/live channels should accept a connection and send the
initial `connected` envelope. Full loop behaviour is covered by the REST
integration tests; here we just assert the WS plumbing is wired.
"""
import uuid


def test_auction_ws_handshake(client):
    sid = uuid.uuid4()
    with client.websocket_connect(f"/ws/auction/{sid}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connected"
        assert "room" in msg
        # ping/pong keep-alive
        ws.send_text("ping")
        assert ws.receive_json()["type"] == "pong"


def test_live_ws_handshake(client):
    mid = uuid.uuid4()
    with client.websocket_connect(f"/ws/live/{mid}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "connected"
