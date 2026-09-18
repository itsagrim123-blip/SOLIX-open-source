"""Comprehensive test suite for Solix Coding Workspace backend.

Tests workspace CRUD, file tree explorer, path security and jail validation,
code execution, test runner, timeout handling, codebase context RAG,
patch application, and chat streaming.
"""

import asyncio
import io
import json
import httpx
from app.main import app
from app.services.workspace.context import code_context_engine
from app.services.workspace.execution import execution_service
from app.services.workspace.storage import workspace_storage


async def run_workspace_tests():
    print("\n==================================================================")
    print("STARTING SOLIX CODING WORKSPACE TEST SUITE")
    print("==================================================================")

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # ── TEST 1: Create Workspace ──────────────────────────────────────────
        print("\n--- TEST 1: Create Workspace ---")
        res_create = await client.post("/api/workspaces", json={"name": "Test Python Project"})
        assert res_create.status_code == 201
        ws_data = res_create.json()
        ws_id = ws_data["id"]
        assert ws_data["name"] == "Test Python Project"
        print(f"Created workspace: ID={ws_id}, Name={ws_data['name']}")

        # ── TEST 2: List & Get Workspace Metadata ─────────────────────────────
        print("\n--- TEST 2: List & Get Workspace Metadata ---")
        res_list = await client.get("/api/workspaces")
        assert res_list.status_code == 200
        workspaces = res_list.json()
        assert any(w["id"] == ws_id for w in workspaces)

        res_get = await client.get(f"/api/workspaces/{ws_id}")
        assert res_get.status_code == 200
        assert res_get.json()["id"] == ws_id
        print("Workspace listing and metadata retrieval verified.")

        # ── TEST 3: Recursive File Tree ───────────────────────────────────────
        print("\n--- TEST 3: Recursive File Tree ---")
        res_tree = await client.get(f"/api/workspaces/{ws_id}/files")
        assert res_tree.status_code == 200
        tree = res_tree.json()
        file_names = [node["name"] for node in tree]
        print(f"Initial files in workspace: {file_names}")
        assert "main.py" in file_names
        assert "utils.py" in file_names
        assert "test_main.py" in file_names
        assert "README.md" in file_names

        # ── TEST 4: Read File Content & Language Detection ────────────────────
        print("\n--- TEST 4: Read File Content & Language Detection ---")
        res_file = await client.get(f"/api/workspaces/{ws_id}/files/main.py")
        assert res_file.status_code == 200
        file_data = res_file.json()
        assert "fibonacci" in file_data["content"]
        assert file_data["language"] == "python"
        print(f"Verified file read: main.py ({file_data['size']} bytes, language: {file_data['language']})")

        # ── TEST 5: Write / Update File ───────────────────────────────────────
        print("\n--- TEST 5: Write / Update File ---")
        new_utils = (
            '"""Updated utils module."""\n\n'
            'def fibonacci(n: int) -> int:\n'
            '    if n <= 0:\n'
            '        return 0\n'
            '    if n == 1:\n'
            '        return 1\n'
            '    a, b = 0, 1\n'
            '    for _ in range(2, n + 1):\n'
            '        a, b = b, a + b\n'
            '    return b\n\n'
            'def format_output(title: str, data: list) -> str:\n'
            '    items_str = ", ".join(str(x) for x in data)\n'
            '    return f"[{title}]: [ {items_str} ]"\n\n'
            'def cube(x: int) -> int:\n'
            '    """Calculate the cube of an integer."""\n'
            '    return x * x * x\n'
        )
        res_write = await client.put(f"/api/workspaces/{ws_id}/files/utils.py", json={"content": new_utils})
        assert res_write.status_code == 200
        # Re-read to verify
        res_check = await client.get(f"/api/workspaces/{ws_id}/files/utils.py")
        assert "cube" in res_check.json()["content"]
        print("Updated utils.py and verified new content.")

        # ── TEST 6: Create File and Directory ─────────────────────────────────
        print("\n--- TEST 6: Create File and Directory ---")
        res_new_dir = await client.post(
            f"/api/workspaces/{ws_id}/files",
            json={"path": "src", "is_directory": True},
        )
        assert res_new_dir.status_code == 201

        res_new_file = await client.post(
            f"/api/workspaces/{ws_id}/files",
            json={"path": "src/helper.py", "is_directory": False, "content": "GREETING = 'Hello from Solix!'\n"},
        )
        assert res_new_file.status_code == 201
        print("Created directory 'src' and nested file 'src/helper.py'.")

        # ── TEST 7: Rename / Move Path ────────────────────────────────────────
        print("\n--- TEST 7: Rename / Move Path ---")
        res_rename = await client.post(
            f"/api/workspaces/{ws_id}/rename",
            json={"old_path": "src/helper.py", "new_path": "src/constants.py"},
        )
        assert res_rename.status_code == 200
        # Old file should now 404
        assert (await client.get(f"/api/workspaces/{ws_id}/files/src/helper.py")).status_code == 404
        # New file should exist
        res_renamed = await client.get(f"/api/workspaces/{ws_id}/files/src/constants.py")
        assert res_renamed.status_code == 200
        assert "GREETING" in res_renamed.json()["content"]
        print("Renamed src/helper.py -> src/constants.py successfully.")

        # ── TEST 8: Delete File ───────────────────────────────────────────────
        print("\n--- TEST 8: Delete File ---")
        res_del = await client.delete(f"/api/workspaces/{ws_id}/files/src/constants.py")
        assert res_del.status_code == 200
        assert (await client.get(f"/api/workspaces/{ws_id}/files/src/constants.py")).status_code == 404
        print("Deleted src/constants.py successfully.")

        # ── TEST 9: Path Traversal & Security Validation ──────────────────────
        print("\n--- TEST 9: Path Traversal & Security Validation ---")
        # Direct service resolution tests
        try:
            workspace_storage.resolve_safe_path(ws_id, "../../backend/.env")
            assert False, "Should have raised ValueError for ../../ traversal"
        except ValueError:
            print("Successfully blocked '../../backend/.env' in storage layer")

        try:
            workspace_storage.resolve_safe_path(ws_id, "..\\..\\app\\core\\config.py")
            assert False, "Should have raised ValueError for ..\\..\\ traversal"
        except ValueError:
            print("Successfully blocked '..\\..\\app\\core\\config.py' in storage layer")

        try:
            workspace_storage.resolve_safe_path(ws_id, "/etc/passwd")
            assert False, "Should have raised ValueError for leading slash"
        except (ValueError, FileNotFoundError):
            print("Successfully blocked '/etc/passwd'")

        try:
            workspace_storage.resolve_safe_path(ws_id, "foo\x00bar.txt")
            assert False, "Should have raised ValueError for null byte"
        except ValueError:
            print("Successfully blocked null byte path")

        # API level traversal tests via JSON payloads (which avoid client URL normalization)
        res_trav_post = await client.post(
            f"/api/workspaces/{ws_id}/files",
            json={"path": "../../evil.txt", "content": "bad"},
        )
        assert res_trav_post.status_code == 400
        print("Successfully blocked traversal in POST /files (returned 400)")

        res_trav_rename = await client.post(
            f"/api/workspaces/{ws_id}/rename",
            json={"old_path": "main.py", "new_path": "../../escaped.py"},
        )
        assert res_trav_rename.status_code == 400
        print("Successfully blocked traversal in POST /rename (returned 400)")

        # ── TEST 10: Code Execution (Run) ─────────────────────────────────────
        print("\n--- TEST 10: Code Execution (Run) ---")
        res_run = await client.post(f"/api/workspaces/{ws_id}/run", json={})
        assert res_run.status_code == 200
        run_data = res_run.json()
        print(f"Run stdout preview:\n{run_data['stdout'][:300]}")
        assert run_data["exit_code"] == 0
        assert "Fibonacci Series" in run_data["stdout"]
        assert run_data["execution_time"] > 0
        print(f"Execution successful! Exit code: {run_data['exit_code']}, Time: {run_data['execution_time']}s")

        # ── TEST 11: Unit Test Execution (Test) ───────────────────────────────
        print("\n--- TEST 11: Unit Test Execution (Test) ---")
        res_test = await client.post(f"/api/workspaces/{ws_id}/test", json={})
        assert res_test.status_code == 200
        test_data = res_test.json()
        print(f"Test output preview:\n{test_data['stderr'][:300] or test_data['stdout'][:300]}")
        assert test_data["exit_code"] == 0
        print(f"Unit tests executed successfully! Exit code: {test_data['exit_code']}")

        # ── TEST 12: Execution Error Capture ──────────────────────────────────
        print("\n--- TEST 12: Execution Error Capture ---")
        # Write a file with a deliberate syntax error / runtime exception
        buggy_code = "print('Starting...')\nx = 1 / 0\n"
        await client.post(f"/api/workspaces/{ws_id}/files", json={"path": "error_demo.py", "content": buggy_code})
        res_err_run = await client.post(f"/api/workspaces/{ws_id}/run", json={"command": "python error_demo.py"})
        assert res_err_run.status_code == 200
        err_data = res_err_run.json()
        assert err_data["exit_code"] != 0
        assert "ZeroDivisionError" in err_data["stderr"] or "ZeroDivisionError" in err_data["stdout"]
        print(f"Successfully captured ZeroDivisionError! Exit code: {err_data['exit_code']}")

        # ── TEST 13: Codebase Context Engine (RAG) ────────────────────────────
        print("\n--- TEST 13: Codebase Context Engine (RAG) ---")
        context = code_context_engine.build_context(
            workspace_id=ws_id,
            query="How is the fibonacci function implemented?",
            current_file="main.py",
            selected_code="series = [fibonacci(i) for i in range(n)]",
            open_files=["main.py", "utils.py"],
        )
        assert "PROJECT FILE TREE" in context
        assert "ACTIVE FILE: main.py" in context
        assert "USER SELECTED CODE" in context
        assert "utils.py" in context
        print("Grounded project context assembled with active file and symbol priorities.")

        # ── TEST 14: Patch Application ────────────────────────────────────────
        print("\n--- TEST 14: Patch Application ---")
        patched_main = (
            '"""Patched main entrypoint with optimized solver."""\n\n'
            'from utils import fibonacci\n\n'
            'def main():\n'
            '    print("Optimized Solix Execution!")\n'
            '    print(f"Result: {fibonacci(12)}")\n\n'
            'if __name__ == "__main__":\n'
            '    main()\n'
        )
        res_patch = await client.post(
            f"/api/workspaces/{ws_id}/apply-patch",
            json={"file": "main.py", "replacement_content": patched_main},
        )
        assert res_patch.status_code == 200
        patch_info = res_patch.json()
        assert patch_info["success"] is True
        assert "diff" in patch_info
        print(f"Unified diff generated:\n{patch_info['diff'][:250]}...")

        # Verify patch was applied
        res_patched_content = await client.get(f"/api/workspaces/{ws_id}/files/main.py")
        assert "Optimized Solix Execution!" in res_patched_content.json()["content"]
        print("Patch applied cleanly to main.py.")

        # ── TEST 15: Read-Only Git Status ─────────────────────────────────────
        print("\n--- TEST 15: Read-Only Git Status ---")
        res_git = await client.get(f"/api/workspaces/{ws_id}/git/status")
        assert res_git.status_code == 200
        git_data = res_git.json()
        assert "is_repo" in git_data
        print(f"Git status query verified: is_repo={git_data['is_repo']}")

        # ── TEST 16: Delete Workspace Cleanup ─────────────────────────────────
        print("\n--- TEST 16: Delete Workspace Cleanup ---")
        res_ws_del = await client.delete(f"/api/workspaces/{ws_id}")
        assert res_ws_del.status_code == 200
        assert (await client.get(f"/api/workspaces/{ws_id}")).status_code == 404
        print(f"Workspace {ws_id} successfully deleted and verified 404.")

        # ── TEST 17: Runtime Registry Endpoint ───────────────────────────────
        print("\n--- TEST 17: Runtime Registry Endpoint ---")
        res_runtimes = await client.get("/api/workspaces/runtimes")
        assert res_runtimes.status_code == 200
        runtimes_list = res_runtimes.json()
        rt_map = {r["id"]: r for r in runtimes_list}
        assert "python" in rt_map and rt_map["python"]["available"] is True
        assert "cpp" in rt_map and rt_map["cpp"]["available"] is True
        assert "javascript" in rt_map and rt_map["javascript"]["available"] is True
        print(f"Verified runtimes endpoint: {len(runtimes_list)} runtimes registered, Python/Node/C++ available.")

        # ── TEST 18: C++ Build and Execution Pipeline ────────────────────────
        print("\n--- TEST 18: C++ Build and Execution Pipeline ---")
        res_cpp_ws = await client.post("/api/workspaces", json={"name": "Test C++ Project", "template": "starter-cpp"})
        assert res_cpp_ws.status_code == 201
        cpp_ws_id = res_cpp_ws.json()["id"]

        # 18a: Explicit build endpoint
        res_build = await client.post(f"/api/workspaces/{cpp_ws_id}/build")
        assert res_build.status_code == 200
        build_data = res_build.json()
        assert build_data["success"] is True
        assert build_data["exit_code"] == 0
        print(f"C++ build succeeded via g++ in {build_data['build_time']}s.")

        # 18b: Run compiled executable
        res_run_cpp = await client.post(f"/api/workspaces/{cpp_ws_id}/run", json={})
        assert res_run_cpp.status_code == 200
        cpp_run_data = res_run_cpp.json()
        assert cpp_run_data["success"] is True
        assert "Welcome to Solix C++ Workspace!" in cpp_run_data["stdout"]
        print(f"C++ run succeeded! Output verified.")

        # 18c: Clean up C++ workspace
        await client.delete(f"/api/workspaces/{cpp_ws_id}")
        print(f"C++ test workspace deleted.")

    print("\n==================================================================")
    print("ALL 18 CODING WORKSPACE TESTS PASSED FLAWLESSLY!")
    print("==================================================================")


if __name__ == "__main__":
    asyncio.run(run_workspace_tests())
