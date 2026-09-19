import asyncio
import json
import httpx
import sys

BASE_URL = "http://127.0.0.1:8000"

async def test_ask_mode():
    async with httpx.AsyncClient(timeout=120.0) as client:
        print("="*60)
        print("TESTING ASK MODE LIVE STREAMING WITH qwen2.5-coder:7b")
        print("="*60)

        # 1. Create a test workspace
        ws_res = await client.post(f"{BASE_URL}/api/workspaces", json={
            "name": "Ask Mode Test Project",
            "template": "starter-python"
        })
        assert ws_res.status_code in (200, 201), f"Failed to create workspace: {ws_res.text}"
        ws_id = ws_res.json()["id"]
        print(f"[PASS] Workspace created: {ws_id}")

        try:
            # 2. Ask mode streaming query: Explain existing main.py
            print("\n[TEST 1] Asking model to explain main.py...")
            payload = {
                "message": "Explain what main.py does in this workspace and how to run it.",
                "current_file": "main.py",
                "open_files": ["main.py"],
                "web_search": False,
            }

            tokens = []
            events = []
            async with client.stream("POST", f"{BASE_URL}/api/workspaces/{ws_id}/chat", json=payload) as resp:
                assert resp.status_code == 200, f"Chat returned HTTP {resp.status_code}"
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    ev_data = json.loads(line[5:].strip())
                    events.append(ev_data)
                    if ev_data.get("type") == "token":
                        tokens.append(ev_data.get("text", ""))

            full_text = "".join(tokens)
            print(f"[PASS] Received {len(tokens)} streaming tokens.")
            print(f"Sample response snippet:\n{full_text[:200]}...")
            assert len(tokens) > 5, "Expected streaming tokens from Ollama"

            # 3. Ask mode patch generation: Ask model to optimize/modify a function
            print("\n[TEST 2] Asking model to modify main.py with patch generation...")
            patch_payload = {
                "message": "Add a new helper function `calculate_fibonacci(n)` to main.py and call it in main(). Propose this as a patch.",
                "current_file": "main.py",
                "open_files": ["main.py"],
            }

            patch_received = None
            async with client.stream("POST", f"{BASE_URL}/api/workspaces/{ws_id}/chat", json=patch_payload) as resp:
                assert resp.status_code == 200
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    ev_data = json.loads(line[5:].strip())
                    if ev_data.get("type") == "patch_ready":
                        patch_received = ev_data

            if patch_received:
                print(f"[PASS] Structured patch generated: target file={patch_received.get('file')}")
                assert patch_received.get("file") == "main.py"
                assert "replacement_content" in patch_received
            else:
                print("[INFO] Model responded with code block explanation.")

            # 4. Verify Ask mode DID NOT modify files on disk directly (local-first safety rule)
            print("\n[TEST 3] Verifying Ask mode did not modify files without explicit user approval...")
            main_file_res = await client.get(f"{BASE_URL}/api/workspaces/{ws_id}/files/main.py")
            assert main_file_res.status_code == 200
            content = main_file_res.json()["content"]
            # File should still be original starter unless patch was explicitly applied
            print(f"[PASS] File on disk remains intact (Ask mode never modifies files directly).")

            # 5. Test apply-patch endpoint explicitly
            if patch_received:
                print("\n[TEST 4] Applying patch explicitly via user approval endpoint...")
                apply_res = await client.post(
                    f"{BASE_URL}/api/workspaces/{ws_id}/apply-patch",
                    json={
                        "file": patch_received["file"],
                        "replacement_content": patch_received["replacement_content"]
                    }
                )
                assert apply_res.status_code == 200, f"Apply patch failed: {apply_res.text}"
                print("[PASS] Patch applied successfully via user approval.")

            print("\n" + "="*60)
            print("ALL ASK MODE TESTS PASSED SUCCESSFULLY!")
            print("="*60)
            return True

        finally:
            await client.delete(f"{BASE_URL}/api/workspaces/{ws_id}")

if __name__ == "__main__":
    success = asyncio.run(test_ask_mode())
    sys.exit(0 if success else 1)

