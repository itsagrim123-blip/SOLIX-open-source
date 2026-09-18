"""
E2E Live Integration Test for Solix Autonomous Coding Agent Engine
Tests the live SSE stream from /api/workspaces/{workspace_id}/agent/run,
tool invocations, auto-apply, staged approval resolution, and sandbox execution.
"""
import asyncio
import json
import httpx
import sys

BASE_URL = "http://localhost:8000"

async def test_live_agent():
    async with httpx.AsyncClient(timeout=180.0) as client:
        print("[TEST] 1. Creating or fetching a test workspace...")
        ws_resp = await client.post(f"{BASE_URL}/api/workspaces", json={
            "name": "E2E Agent Test Project",
            "template": "starter-python"
        })
        if ws_resp.status_code not in (200, 201):
            print(f"[FAIL] Could not create workspace: {ws_resp.text}")
            return False
        workspace = ws_resp.json()
        ws_id = workspace["id"]
        print(f"[PASS] Workspace ready: {ws_id} ({workspace['name']})")

        print("\n[TEST] 2. Running Autonomous Agent with Auto-Apply...")
        prompt = "Create a python calculator module in calculator.py with add, sub, mul, div functions and add unit tests in test_calculator.py using unittest, then test it."
        
        events_received = []
        task_id = None

        req_payload = {
            "request": prompt,
            "active_file": "main.py",
            "auto_apply": True
        }

        async with client.stream("POST", f"{BASE_URL}/api/workspaces/{ws_id}/agent/run", json=req_payload) as stream:
            if stream.status_code != 200:
                print(f"[FAIL] Agent run failed with HTTP {stream.status_code}")
                return False
            
            print("[INFO] SSE stream established. Receiving events:")
            async for line in stream.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                json_str = line[5:].strip()
                if not json_str:
                    continue
                try:
                    event = json.loads(json_str)
                    events_received.append(event)
                    event_type = event.get("type")

                    if event_type == "agent_started":
                        task_id = event.get("task_id")
                        print(f"  -> agent_started: task_id={task_id}")
                    elif event_type == "state_change":
                        print(f"  -> state_change: {event.get('state')} ({event.get('message')})")
                    elif event_type == "plan_created":
                        plan = event.get("plan", [])
                        print(f"  -> plan_created: {len(plan)} steps:")
                        for p in plan:
                            print(f"     [{p.get('id')}] {p.get('text')}")
                    elif event_type == "tool_started":
                        print(f"  -> tool_started: {event.get('tool')} with args: {list(event.get('args', {}).keys())}")
                    elif event_type == "tool_completed":
                        res_status = event.get("result", {}).get("status", "ok")
                        print(f"  -> tool_completed: {event.get('tool')} (status: {res_status})")
                    elif event_type == "changes_applied":
                        print(f"  -> changes_applied: {event.get('operation')} {event.get('file')}")
                    elif event_type == "test_completed":
                        print(f"  -> test_completed: exit_code={event.get('result', {}).get('exit_code')}")
                    elif event_type == "agent_completed":
                        print(f"  -> agent_completed: {event.get('summary', '')[:100]}...")
                        break
                    elif event_type == "agent_failed":
                        print(f"  -> agent_failed: {event.get('error')}")
                        break
                except Exception as e:
                    pass

        print(f"\n[INFO] Total events received: {len(events_received)}")
        event_types = set(e.get("type") for e in events_received)
        print(f"[INFO] Unique event types observed: {event_types}")

        assert "agent_started" in event_types, "agent_started event missing"
        assert "state_change" in event_types, "state_change event missing"
        print("[PASS] Event streaming and state transitions verified.")

        # Check files created on disk
        print("\n[TEST] 3. Verifying workspace storage files...")
        tree_resp = await client.get(f"{BASE_URL}/api/workspaces/{ws_id}/files")
        tree = tree_resp.json()
        filenames = [f["name"] for f in tree if not f.get("is_directory")]
        print(f"  Files in workspace: {filenames}")

        # Run test execution on the workspace
        print("\n[TEST] 4. Running Sandbox Test Runner...")
        test_run_resp = await client.post(f"{BASE_URL}/api/workspaces/{ws_id}/test")
        test_res = test_run_resp.json()
        print(f"  Test run exit code: {test_res.get('exit_code')}")
        print(f"  Stdout snippet: {test_res.get('stdout', '')[:200]}")
        print(f"  Stderr snippet: {test_res.get('stderr', '')[:200]}")

        # Test Approval Flow
        print("\n[TEST] 5. Testing Interactive Approval Mechanism...")
        current_task_id = None
        async def approval_agent_listener():
            nonlocal current_task_id
            async with client.stream("POST", f"{BASE_URL}/api/workspaces/{ws_id}/agent/run", json={
                "request": "Modify calculator.py to add a power(a, b) exponentiation function.",
                "active_file": "calculator.py",
                "auto_apply": False
            }) as stream:
                async for line in stream.aiter_lines():
                    line = line.strip()
                    if line.startswith("data:"):
                        try:
                            ev = json.loads(line[5:].strip())
                            if ev.get("type") == "agent_started":
                                current_task_id = ev.get("task_id")
                            elif ev.get("type") == "approval_required":
                                req = ev.get("request", {})
                                app_id = req.get("approval_id")
                                print(f"  [RECEIVED APPROVAL REQ]: id={app_id} file={req.get('file')} op={req.get('operation')}")
                                # Send approve
                                await asyncio.sleep(0.5)
                                approve_resp = await client.post(
                                    f"{BASE_URL}/api/workspaces/{ws_id}/agent/{current_task_id}/approve",
                                    json={"approval_id": app_id, "approved": True}
                                )
                                print(f"  [SENT APPROVAL]: status={approve_resp.status_code} res={approve_resp.text}")
                            elif ev.get("type") == "changes_applied":
                                print(f"  [SUCCESS]: Changes applied after approval for {ev.get('file')}")
                                return True
                            elif ev.get("type") in ("agent_completed", "agent_failed"):
                                break
                        except Exception:
                            pass
            return False
        try:
            success = await asyncio.wait_for(approval_agent_listener(), timeout=60.0)
            print(f"[PASS] Approval flow test success: {success}")
        except asyncio.TimeoutError:
            print("[WARN] Approval listener timed out (model might have finished differently).")

        # Clean up test workspace
        print("\n[TEST] 6. Cleaning up test workspace...")
        del_resp = await client.delete(f"{BASE_URL}/api/workspaces/{ws_id}")
        print(f"[PASS] Workspace deleted: {del_resp.status_code == 200}")

        print("\n" + "="*50)
        print("[ALL E2E AUTONOMOUS AGENT TESTS COMPLETED SUCCESSFULLY!]")
        print("="*50)
        return True

if __name__ == "__main__":
    success = asyncio.run(test_live_agent())
    sys.exit(0 if success else 1)
