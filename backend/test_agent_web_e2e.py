"""
E2E Web Project Agent Test (HTML/CSS/JS)
Tests creating a complete web application with the agent and verifying it in the sandbox.
"""
import asyncio
import json
import httpx
import sys

BASE_URL = "http://localhost:8000"

async def test_web_agent():
    async with httpx.AsyncClient(timeout=180.0) as client:
        print("="*60)
        print("TESTING AUTONOMOUS AGENT ON WEB PROJECT (HTML/CSS/JS)")
        print("="*60)

        # 1. Create a web workspace
        ws_resp = await client.post(f"{BASE_URL}/api/workspaces", json={
            "name": "Web Calculator App",
            "template": "starter-html"
        })
        assert ws_resp.status_code in (200, 201), f"Failed to create workspace: {ws_resp.text}"
        ws_id = ws_resp.json()["id"]
        print(f"[PASS] Workspace created: {ws_id}")

        try:
            # 2. Run agent to build a counter app
            prompt = "Build a clean, responsive Counter web app with index.html, styles.css, and app.js. Include increment, decrement, and reset buttons with a counter display."
            req_payload = {
                "request": prompt,
                "active_file": "index.html",
                "auto_apply": True
            }

            events = []
            async with client.stream("POST", f"{BASE_URL}/api/workspaces/{ws_id}/agent/run", json=req_payload) as stream:
                assert stream.status_code == 200, f"HTTP {stream.status_code}"
                async for line in stream.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    ev = json.loads(line[5:].strip())
                    events.append(ev)
                    ev_type = ev.get("type")
                    if ev_type == "tool_started":
                        print(f"  -> tool_started: {ev.get('tool')}")
                    elif ev_type == "changes_applied":
                        print(f"  -> changes_applied: {ev.get('operation')} {ev.get('file')}")
                    elif ev_type == "agent_completed":
                        print(f"  -> agent_completed: {ev.get('summary', '')[:80]}...")
                        break
                    elif ev_type == "agent_failed":
                        print(f"  -> agent_failed: {ev.get('error')}")
                        return False

            # Verify files in workspace
            tree_resp = await client.get(f"{BASE_URL}/api/workspaces/{ws_id}/files")
            tree = tree_resp.json()
            filenames = [f["name"] for f in tree if not f.get("is_directory")]
            print(f"\n[INFO] Workspace files: {filenames}")
            assert "index.html" in filenames, "index.html should exist"

            # Check that syntax checker passed on the files
            prob_resp = await client.post(f"{BASE_URL}/api/workspaces/{ws_id}/test")
            test_res = prob_resp.json()
            print(f"[INFO] Web validation result: exit_code={test_res.get('exit_code')}")
            assert test_res.get("exit_code") == 0, f"Web validation failed: {test_res}"

            print("\n" + "="*60)
            print("WEB PROJECT AUTONOMOUS AGENT VERIFIED SUCCESSFULLY!")
            print("="*60)
            return True

        finally:
            await client.delete(f"{BASE_URL}/api/workspaces/{ws_id}")

if __name__ == "__main__":
    success = asyncio.run(test_web_agent())
    sys.exit(0 if success else 1)

